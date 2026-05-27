const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { name, phone, email, service, projectDetails, timing } = JSON.parse(event.body);

    // Validate required fields
    if (!name || !phone || !email || !service) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Gmail configuration
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Email to J. Worden & Sons owners
    const ownerEmailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #1c3a47 0%, #2d5a6f 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h2 { margin: 0; color: #f59e0b; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #1c3a47; }
    .value { color: #666; padding: 8px 0; }
    .cta { background: #f59e0b; color: white; padding: 12px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🎯 NEW CHAT LEAD - J. Worden & Sons</h2>
    </div>
    
    <div class="field">
      <div class="label">Name:</div>
      <div class="value">${name}</div>
    </div>

    <div class="field">
      <div class="label">Phone:</div>
      <div class="value"><a href="tel:${phone}">${phone}</a></div>
    </div>

    <div class="field">
      <div class="label">Email:</div>
      <div class="value"><a href="mailto:${email}">${email}</a></div>
    </div>

    <div class="field">
      <div class="label">Service Interested In:</div>
      <div class="value">${service}</div>
    </div>

    <div class="field">
      <div class="label">Project Details:</div>
      <div class="value">${projectDetails || 'Not provided'}</div>
    </div>

    <div class="field">
      <div class="label">Project Timing:</div>
      <div class="value">${timing || 'Not provided'}</div>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0; color: #999; font-size: 12px;">
      <p>This lead came from the chat widget on your website. Follow up promptly to convert!</p>
    </div>
  </div>
</body>
</html>
    `;

    // Auto-reply email to customer
    const customerEmailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
    .header { background: linear-gradient(135deg, #1c3a47 0%, #2d5a6f 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h2 { margin: 0; }
    .highlight { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; border-radius: 3px; }
    .cta { background: #f59e0b; color: white; padding: 12px 20px; border-radius: 5px; text-decoration: none; display: inline-block; margin-top: 15px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Thanks for contacting J. Worden & Sons! 🎉</h2>
    </div>
    
    <p>Hi ${name},</p>

    <p>We received your request for a free driveway paving estimate. Our team will contact you within 24 hours to discuss your project and answer any questions.</p>

    <div class="highlight">
      <strong>In the meantime, feel free to call us:</strong><br>
      📞 <a href="tel:8044461296">(804) 446-1296</a><br>
      Hours: Mon–Fri 7am–6pm · Sat 8am–2pm
    </div>

    <h3>What to expect:</h3>
    <ul>
      <li>Free, no-obligation in-person estimate</li>
      <li>Detailed written quote within 24 hours</li>
      <li>Expert consultation on your ${service.toLowerCase()}</li>
      <li>40+ years of trusted Richmond-area paving experience</li>
    </ul>

    <p>
      <strong>Have questions in the meantime?</strong> Visit us at:
      <a href="https://jwordenasphaltpaving.com" style="color: #f59e0b; text-decoration: none; font-weight: bold;">jwordenasphaltpaving.com</a>
    </p>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0; color: #999; font-size: 12px;">
      <p>J. Worden & Sons Asphalt Paving · Chester, VA 23836<br>Virginia Class A Contractor License · Licensed & Insured</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email to owners
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_RECIPIENTS, // e.g., jhworden1@gmail.com,genewgeorge@gmail.com
      subject: `🎯 NEW LEAD: ${name} - ${service}`,
      html: ownerEmailContent,
      replyTo: email
    });

    // Send auto-reply to customer
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Thanks for contacting J. Worden & Sons! 🎉',
      html: customerEmailContent
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Lead captured successfully' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process lead', details: error.message })
    };
  }
};
