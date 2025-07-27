const mysql = require('mysql');
const con = mysql.createConnection({
  host: 'rds-qless.clqoumo02aa3.ap-southeast-2.rds.amazonaws.com',
  user: 'admin',
  password: 'password',
  database: 'rds_qless',
  port: 3306
});

exports.handler = async (event) => {
  // Same CORS headers as your working functions
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://main.d31r1t8vrdz0fb.amplifyapp.com',
    'Access-Control-Allow-Headers': 'content-type,authorization,x-amz-date,x-api-key,x-amz-security-token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Handle OPTIONS request for CORS
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Handle GET request for all items
  if (httpMethod === 'GET') {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM items';
      con.query(sql, (err, results) => {
        if (err) {
          console.error('Database error:', err);
          resolve({ 
            statusCode: 500, 
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
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

  // Handle unsupported methods
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ message: "Method not allowed" })
  };
};