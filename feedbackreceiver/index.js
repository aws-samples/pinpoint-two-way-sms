const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();
const pinpoint = new AWS.Pinpoint();
const aws_region = "us-east-1";
const feedbackScoreRequiredFallCallback=5;

exports.handler = async (event) => {
  console.log("Lambda triggered with event: " + JSON.stringify(event));
  //Source of this lambda function is the SQS engine.
  if(!event.Records) return "ERROR: Unexpected payload.";
  let hasError=false;
  for (const item of event.Records) {
       try{
         let body=JSON.parse(item.body);
         let messageBody=body.messageBody;
         let messageId=body.previousPublishedMessageId;
         let destinationNumber=body.originationNumber;
         //update the feedbacks table with the feedback number received.
         var feedback = parseInt(messageBody);
         if(!isNaN(feedback)){
         	//determine the conversation stage. If this is the first feedback from the user, stage returns as 1.
            let lookupData=await lookupAppointmentIdAndStage(messageId); // if messageid is not known throws an error. 
         	let currentStage=lookupData.ConversationStage;
         	let appointmentId=lookupData.AppointmentId;
         	let message;
         	let isConversationFinished=true;

            if(currentStage==1){
            	//update the feedback score
            	await updateDynamoDbFeedbackScore (appointmentId, feedback);
	            //send thank you sms
	            message = "Thank you for your feedback!";
	            //if we received a feedback score that is less than feedbackScoreRequiredFallCallback, ask another question.
	            if(feedback<feedbackScoreRequiredFallCallback){
	            	message="Sorry we didn’t meet your expectations. Would you be willing to receive a call from us with a more in-depth survey? Please reply with 1 for Yes, 0 for No";
	            	currentStage=currentStage+1;
	            	isConversationFinished=false;
	            }
            }
            else if(currentStage==2){
            	//if the feedback is 1, set the callback field to Y. Treat all other feedbacks as no.
            	 await updateDynamoDbCallbackFlag (appointmentId, feedback==1?'Y':'N');
	            //send thank you sms
	            message = feedback==1?"One of our team members will reach out to you as soon as possible. Thank you!":"Thank you for your feedback!";
            }
            else
            	throw ('unknown stage');

            var smsParams = {
	                        ApplicationId: process.env.APPLICATION_ID,
	                        MessageRequest: {
	                          Addresses: {
	                            [destinationNumber]: {
	                              ChannelType: 'SMS'
	                            }
	                          },
	                          MessageConfiguration: {
	                            SMSMessage: {
	                              Body: message,
	                              MessageType: 'TRANSACTIONAL'
	                            }
	                          }
	                        }
	            };

            let result=await sendSMS(smsParams);
            messageId=result['MessageResponse']['Result'][destinationNumber]['MessageId'];

            if(isConversationFinished==false){
            	//if conversation will continue, add the last messageid and the new stage to the lookup table
            	//add this messageid to message-id order-id lookup table
                    var params = {
                                TableName: "message-lookup",
                                ReturnConsumedCapacity: "TOTAL",
                                Item: {
                                    "FeedbackMessageId": messageId,
                                    "AppointmentId": appointmentId,
                                    "ConversationStage": currentStage
                                }
                    };
                    result= await docClient.put(params).promise();
            }
        }//isNAN
       }
       catch(err){
        //sms's which include non-numeric responses or which doesn't have corresponding feedbackmessageids will be ignored.
         console.error(err.name, err.message);
       }
  }//for
  return "OK";
};//eventHandler


async function lookupAppointmentIdAndStage(messageId){
	try {
			var params = {
			  TableName : 'message-lookup',
			  Key: {
			    FeedbackMessageId: messageId
			  }
			};
	    	const data = await docClient.get(params).promise();
	    	return data.Item;
	} catch (err) {
	    console.log("Failure", err.message)
	    throw err;
	}
}

async function updateDynamoDbFeedbackScore (appointmentId, feedbackScore){
	  const strAppintmentId=appointmentId.toString();
	  let params = {
	      TableName:'feedbacks',
	      Key:{
	          "AppointmentId": strAppintmentId
	      },
	      UpdateExpression: "set FeedbackScore = :val1",
	      ConditionExpression: "attribute_exists(AppointmentId)",
	      ExpressionAttributeValues:{
	          ":val1":feedbackScore
	      },
	      ReturnValues:"UPDATED_NEW"
	  };
	  try {
		    const data = await docClient.update(params).promise();
		    return data;
	 } catch (err) {
		    console.log("Failure", err.message)
		    throw err;
	 }
}


async function updateDynamoDbCallbackFlag (appointmentId, callBackFlag){
	  let params = {
	      TableName:'feedbacks',
	      Key:{
	          "AppointmentId": appointmentId
	      },
	      UpdateExpression: "set CallbackRequested = :val1",
	      ConditionExpression: "attribute_exists(AppointmentId)",
	      ExpressionAttributeValues:{
	          ":val1":callBackFlag
	      },
	      ReturnValues:"UPDATED_NEW"
	 };
  	try {
		    const data = await docClient.update(params).promise();
		    return data;
	 } catch (err) {
		    console.log("Failure", err.message)
		    throw err;
	 }
}

async function sendSMS (params) {
    return new Promise ((resolve,reject) => {
        pinpoint.sendMessages(params, function(err, data) {
                      // If something goes wrong, print an error message.
                      if(err) {
                        console.log(err.message);
                        reject(err);
                      // Otherwise, show the unique ID for the message.
                      } else {
                        resolve(data);
                      }
        });
 
    });
}