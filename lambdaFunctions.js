// 1) Deduct from wallet

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // CORS headers matching your working functions
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
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
        body: JSON.stringify({ 
          message: 'Wallet balance deducted successfully', 
          wallet_id: wallet.wallet_id,
          new_balance: wallet.balance - amount_to_deduct
        })
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


// 2) Register a container on loan and register to DynamoDB that status is "On Loan"

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // Same CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle OPTIONS request
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle POST request for container loan registration
  
  if (httpMethod === 'POST') {
    try {
      const { user_id, container_id } = JSON.parse(event.body);

      if (!user_id || !container_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'user_id and container_id are required' })
        };
      }

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

      await docClient.put(params).promise();
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          message: "Container loan recorded successfully", 
          loan_id,
          container_id,
          status: "Borrowed"
        })
      };

    } catch (err) {
      console.error('Error in ContainerLoan:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};



// 3) Fetch data of containers that are on loan for a user

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // Same CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle OPTIONS request
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle GET request
  if (httpMethod === 'GET') {
    try {
      const user_id = event.pathParameters?.user_id;

      if (!user_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'user_id is required' })
        };
      }

      const params = {
        TableName: 'containerLoan',
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: {
          ':uid': user_id
        },
        ScanIndexForward: false // Sort by loan_date descending
      };

      const result = await docClient.query(params).promise();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.Items)
      };

    } catch (err) {
      console.error('Error in GetContainerLoans:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};






// 4) Return a specific container that is on loan

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  // Same CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle OPTIONS request
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle PUT request for returning container
  if (httpMethod === 'PUT') {
    try {
      const { status, return_date } = JSON.parse(event.body);
      const { user_id, loan_id } = event.pathParameters;

      if (!user_id || !loan_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'user_id and loan_id are required' })
        };
      }

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
        headers,
        body: JSON.stringify({ 
          message: "Container has been returned successfully!",
          loan_id,
          status,
          return_date
        })
      };

    } catch (err) {
      console.error('Error in ReturnContainer:', err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};




// Record a transaction record to RDS

const mysql = require('mysql2/promise'); 

const dbConfig = {
  host: 'rds-qless.clqoumo02aa3.ap-southeast-2.rds.amazonaws.com',
  user: 'admin',
  password: 'password',
  database: 'rds_qless',
  port: 3306
};

exports.handler = async (event) => {
  // Same CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle OPTIONS request
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle POST request for transaction registration
  if (httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      const { user_id, amount_paid, items } = body;

      if (!user_id || !amount_paid) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'user_id and amount_paid are required' })
        };
      }

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
        headers,
        body: JSON.stringify({ 
          message: 'Transaction recorded successfully', 
          order_id,
          amount_paid,
          items_count: items ? items.length : 0
        })
      };

    } catch (err) {
      console.error("Transaction Lambda error:", err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Internal error", error: err.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};



//  To list past transactions for a user

const mysql = require('mysql');

exports.handler = async (event) => {
  // Same CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle OPTIONS request
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle GET request
  if (httpMethod === 'GET') {
    const userId = event.pathParameters?.user_id;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Missing user_id" })
      };
    }

    return new Promise((resolve, reject) => {
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
          resolve({
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
          });
        } else {
          resolve({
            statusCode: 200,
            headers,
            body: JSON.stringify(results)
          });
        }
      });
    });
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};