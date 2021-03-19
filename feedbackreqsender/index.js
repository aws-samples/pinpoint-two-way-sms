const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const pinpoint = new AWS.Pinpoint();
const aws_region = "us-east-1";


exports.handler = async (event) => {
    for (const record of event.Records){
        console.log('Stream record: ', JSON.stringify(record, null, 2));
        if (record.eventName == 'MODIFY') {
        	//check if the status is COMPLETED
        	if(record.dynamodb && record.dynamodb.NewImage.AppointmentStatus.S=='COMPLETED'){
        		//send SMS and add record to the feedbacks table.
        		var destinationNumber=record.dynamodb.NewImage.CustomerPhone.S;
        		var appointmentId=record.dynamodb.NewImage.id.S;
        		console.log(destinationNumber);
                try {
                    //send SMS to the destination number
                    var message = "Please rate your recent appointment by replying to this message on as scale of 1 to 10, where 10 representing the best experience. Thank you."
                    + " Reply STOP to opt out.";
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
                    let data = await sendSMS(smsParams);
                    let messageId=data['MessageResponse']['Result'][destinationNumber]['MessageId'];

                    //populate the feedbacks table for this order.
                    var params = {
                                TableName: "feedbacks",
                                ReturnConsumedCapacity: "TOTAL",
                                Item: {
                                    "AppointmentId": appointmentId,
                                    "FeedbackScore": -1,
                                    "CallbackRequested": 'N',
                                    "Timestamp": Math.floor(new Date().getTime() / 1000.0),
                                    "DestinationNumber": destinationNumber
                                }
                    };
                    let result= await docClient.put(params).promise();

                    //add this messageid to the lookup table
                    var params = {
                                TableName: "message-lookup",
                                ReturnConsumedCapacity: "TOTAL",
                                Item: {
                                    "FeedbackMessageId": messageId,
                                    "AppointmentId": appointmentId,
                                    "ConversationStage": 1
                                }
                    };
                    result= await docClient.put(params).promise();
                    console.log(result);
                } catch (err) {
                    console.error(err, err.stack);
                    //return err;
                }
        	}//appointment status is completed
        }
    }
};

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
