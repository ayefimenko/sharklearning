import React from 'react';

const SimpleAdminTest: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: 'yellow', 
      padding: '20px', 
      fontSize: '24px', 
      textAlign: 'center',
      minHeight: '100vh'
    }}>
      <h1>🟡 SIMPLE ADMIN TEST PAGE 🟡</h1>
      <p>If you can see this yellow page, the routing is working!</p>
      <p>Current URL should be: /admin/simple</p>
      <hr />
      <p>Now try these links:</p>
      <div style={{ marginTop: '20px' }}>
        <a href="/admin" style={{ 
          backgroundColor: 'blue', 
          color: 'white', 
          padding: '10px', 
          textDecoration: 'none',
          margin: '10px',
          display: 'inline-block'
        }}>
          Go to /admin
        </a>
        <a href="/admin/dashboard" style={{ 
          backgroundColor: 'green', 
          color: 'white', 
          padding: '10px', 
          textDecoration: 'none',
          margin: '10px',
          display: 'inline-block'
        }}>
          Go to /admin/dashboard
        </a>
      </div>
    </div>
  );
};

export default SimpleAdminTest; 