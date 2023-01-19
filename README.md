## Create a Serverless Feedback Collector Application by Using Amazon Pinpoint’s Two-way SMS Functionality

Create a Serverless Feedback Collector Application by Using Amazon Pinpoint’s Two-way SMS Functionality. Please refer to the accompanying [AWS Blog post](https://aws.amazon.com/blogs/messaging-and-targeting/create-a-serverless-feedback-collector-application-by-using-amazon-pinpoints-two-way-sms-functionality/) for architecture details.

## License Summary
This library is licensed under the MIT-0 License. See the LICENSE file.

## Setup process
This package requires AWS Serverless Application Model (AWS SAM) Command Line Interface (CLI) to deploy to your account. Instructions for installing and setting up SAM CLI can be found here: https://aws.amazon.com/serverless/sam/

## Prerequisites
This serverless application requires that you have an AWS Pinpoint project set up, and configured with voice support and a long code. The Long code must be owned by the same account as Pinpoint and your SAM package are deployed in. Please refer to the accompanying AWS Blog post for details.

## Installing dependencies
Use npm install in the feedbackreceiver and feedbackreqsender directories to install any required packages prior to packaging and deploying this SAM application.

## Packaging and deployment
Firstly, we need a S3 bucket where we can upload our Lambda functions packaged as ZIP before we deploy anything - If you don't have a S3 bucket to store code artifacts then this is a good time to create one:
~~~
aws s3 mb s3://BUCKET_NAME
~~~
Next, run the following command to package our Lambda function to S3:
~~~
sam package \
    --template-file template.yaml \
    --output-template-file output_template.yaml \
    --s3-bucket REPLACE_THIS_WITH_YOUR_S3_BUCKET_NAME
~~~
Next, the following command will create a Cloudformation Stack and deploy your SAM resources.
~~~
sam deploy \
    --template-file output_template.yaml \
    --stack-name blogstack \
    --capabilities CAPABILITY_IAM
~~~    
See Serverless Application Model (SAM) HOWTO Guide for more details in how to get started.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.
