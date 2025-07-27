const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // CORS headers that work with your setup
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle preflight OPTIONS request
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle GET request for user profile
  if (httpMethod === 'GET') {
    const user_id = event.pathParameters.id;

    const params = {
      TableName: 'users',
      Key: { user_id }
    };

    try {
      const data = await docClient.get(params).promise();
      if (!data.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: "User not found" })
        };
      }

      const { password_hash, ...safeUser } = data.Item;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(safeUser)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  // Handle unsupported methods
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};