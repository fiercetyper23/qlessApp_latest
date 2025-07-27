// Deduct from wallet using POST

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // CORS headers that match your working getUser function
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle preflight OPTIONS request
  const httpMethod = event.requestContext.http.method;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle POST request for wallet deduction
  if (httpMethod === 'POST') {
    let user_id, amount_to_deduct;

    try {
      // Parse and validate input
      const body = JSON.parse(event.body);
      user_id = body.user_id;
      amount_to_deduct = body.amount_to_deduct;

      if (!user_id || typeof amount_to_deduct !== 'number') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid input: user_id and numeric amount_to_deduct are required.' })
        };
      }

      // Step 1: Lookup wallet using GSI
      const findParams = {
        TableName: 'wallets',
        IndexName: 'user_id-index',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: {
          ':uid': user_id
        }
      };

      const result = await docClient.query(findParams).promise();

      if (result.Items.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: 'Wallet not found' })
        };
      }

      const wallet = result.Items[0];

      // Step 2: Check for sufficient balance
      if (wallet.balance < amount_to_deduct) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: 'Insufficient funds' })
        };
      }

      // Step 3: Update wallet balance
      const updateParams = {
        TableName: 'wallets',
        Key: { wallet_id: wallet.wallet_id },
        UpdateExpression: 'SET balance = balance - :amt, last_updated = :ts',
        ExpressionAttributeValues: {
          ':amt': amount_to_deduct,
          ':ts': new Date().toISOString()
        }
      };

      await docClient.update(updateParams).promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Wallet balance deducted successfully', wallet_id: wallet.wallet_id })
      };

    } catch (err) {
      console.error('Error in DeductFromWallet:', err);
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




// register new loan on DynamoDB (POST) on DynamoDB. will create a new Loan id for the user_id (after every purchase, customer will loan a container: sustainability)

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const { user_id, container_id } = JSON.parse(event.body);

  const loan_id = 'L' + uuidv4().slice(0, 7).toUpperCase();

  const params = {
    TableName: 'containerLoan',
    Item: {
      user_id,
      loan_id,
      container_id,
      loan_date: new Date().toISOString(),
      return_date: "",
      status: "Borrowed"
    }
  };

  try {
    await docClient.put(params).promise();
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Loan recorded", loan_id })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};



// get all containers on loan from DynamoDB (GET) for a specific  user_id

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const user_id = event.pathParameters.user_id;

  const params = {
    TableName: 'containerLoan',
    KeyConditionExpression: 'user_id = :uid',
    ExpressionAttributeValues: {
      ':uid': user_id
    }
  };

  try {
    const result = await docClient.query(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};




// return specific container by specific user (PUT) on DynamoDB: from "On Loan" to "Returned"

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const { status, return_date } = JSON.parse(event.body);
  const { user_id, loan_id } = event.pathParameters;

  const loanTable = 'containerLoan';
  const containerTable = 'containers';

  // Step 1: Update the loan record
  const updateLoanParams = {
    TableName: loanTable,
    Key: {
      user_id,
      loan_id
    },
    UpdateExpression: 'SET #st = :status, return_date = :ret',
    ExpressionAttributeNames: {
      '#st': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':ret': return_date
    }
  };

  try {
    await docClient.update(updateLoanParams).promise();

    // Step 2: Only increment usage if status is "Returned"
    if (status === "Returned") {
      // Step 3: Fetch the container_id from the loan record
      const getLoanParams = {
        TableName: loanTable,
        Key: { user_id, loan_id }
      };

      const loanData = await docClient.get(getLoanParams).promise();
      const container_id = loanData.Item?.container_id;

      if (container_id) {
        // Step 4: Increment the usage_count
        const updateContainerParams = {
          TableName: containerTable,
          Key: { container_id },
          UpdateExpression: 'SET usage_count = if_not_exists(usage_count, :start) + :incr',
          ExpressionAttributeValues: {
            ':incr': 1,
            ':start': 0
          }
        };

        await docClient.update(updateContainerParams).promise();
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Container has been returned!" })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};




// register new transaction record on RDS (POST) for a specific user_id


const mysql = require('mysql2/promise'); 

const dbConfig = {
  host: 'rds-qless.clqoumo02aa3.ap-southeast-2.rds.amazonaws.com',
  user: 'admin',
  password: 'password',
  database: 'rds_qless',
  port: 3306
};

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { user_id, amount_paid, items } = body;

    const order_id = 'O' + Math.random().toString().slice(2, 9);
    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const connection = await mysql.createConnection(dbConfig);

    // Insert into orders table
    await connection.execute(
      'INSERT INTO orders (order_id, user_id, amount_paid, date_time) VALUES (?, ?, ?, ?)',
      [order_id, user_id, amount_paid, date]
    );

    // Insert into order_items table only if items exist
    if (Array.isArray(items) && items.length > 0) {
      const itemValues = items.map((item, index) => {
        const orderItemId = 'OI' + Math.random().toString().slice(2, 9) + index;
        return [orderItemId, order_id, item.item_id, item.quantity, item.price];
      });

      await connection.query(
        'INSERT INTO order_items (order_item_id, order_id, item_id, quantity, price) VALUES ?',
        [itemValues]
      );
    }

    await connection.end();

    return {
      statusCode: 201,
      body: JSON.stringify({ message: 'Order and items created successfully', order_id })
    };
  } catch (err) {
    console.error("Lambda error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal error", error: err.message })
    };
  }
};



// get all transaction records for a specific user_id (GET) from RDS

const mysql = require('mysql');

exports.handler = (event, context, callback) => {
  const userId = event.pathParameters?.user_id;

  if (!userId) {
    return callback(null, {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing user_id" })
    });
  }

  const con = mysql.createConnection({
    host: 'rds-qless.clqoumo02aa3.ap-southeast-2.rds.amazonaws.com',
    user: 'admin',
    password: 'password',
    database: 'rds_qless',
    port: 3306
  });

  con.query('SELECT * FROM orders WHERE user_id = ? ORDER BY date_time DESC', [userId], (err, results) => {
    con.end();
    if (err) {
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({ error: err.message })
      });
    } else {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify(results)
      });
    }
  });
};





