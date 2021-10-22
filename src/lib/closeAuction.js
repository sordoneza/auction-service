import AWS from "aws-sdk";

const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();

export async function closeAuction(auction) {
  const params = {
    TableName: process.env.AUCTIONS_TABLE_NAME,
    Key: { id: auction.id },
    UpdateExpression: 'set #status = :status',
    ExpressionAttributeValues: {
      ':status': 'CLOSED',
    },
    ExpressionAttributeNames: {
      '#status': 'status'
    }
  };

  await dynamodb.update(params).promise();

  const { title, seller, highestBid } = auction;
  const { amount, bidder } = highestBid;
  let notifyPromises = [];

  notifyPromises.push(
    sqs
      .sendMessage({
        QueueUrl: process.env.MAIL_QUEUE_URL,
        MessageBody: JSON.stringify({
          subject: bidder
            ? "Your item has been sold!"
            : "No bids on your auction item :(",
          recipient: seller,
          body: bidder
            ? `Woohoo! Your item "${title}" has been sold for $${amount}.`
            : "Your item did not receive any bid",
        }),
      })
      .promise()
  );

  if (bidder) {
    notifyPromises.push(
      sqs
        .sendMessage({
          QueueUrl: process.env.MAIL_QUEUE_URL,
          MessageBody: JSON.stringify({
            subject: "You won an auction!",
            recipient: bidder,
            body: `What a great deal! You got yourself a "${title}" for $${amount}.`,
          }),
        })
        .promise()
    );
  }


  return Promise.all(notifyPromises);
}