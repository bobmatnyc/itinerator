/**
 * Quick test to verify authentication cookie handling
 * Run: node test-auth-cookies.js
 */

async function testAuthCookies() {
  const baseUrl = 'http://localhost:5176';
  const email = 'test@test.com';

  console.log('🧪 Testing Authentication Cookie Handling\n');
  console.log(`Node version: ${process.version}`);
  console.log(`Testing against: ${baseUrl}\n`);

  // 1. Test authentication
  console.log('1️⃣ Testing POST /api/auth/login...\n');

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);

  // Check if getSetCookie is available
  if (typeof response.headers.getSetCookie === 'function') {
    console.log('\n✅ getSetCookie() method is available');
    const allCookies = response.headers.getSetCookie();
    console.log('All Set-Cookie headers:', allCookies);
  } else {
    console.log('\n⚠️  getSetCookie() method is NOT available (older Node.js version)');
    const setCookie = response.headers.get('set-cookie');
    console.log('Set-Cookie (single):', setCookie);
  }

  // Parse response
  const data = await response.json();
  console.log('\nResponse Body:', JSON.stringify(data, null, 2));

  // 2. Extract cookies
  console.log('\n2️⃣ Extracting cookies...\n');

  const allCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    allCookies.push(...response.headers.getSetCookie());
  } else {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) allCookies.push(setCookie);
  }

  let sessionValue = '';
  let emailValue = '';

  for (const cookieHeader of allCookies) {
    const sessionMatch = cookieHeader.match(/itinerator_session=([^;]+)/);
    const emailMatch = cookieHeader.match(/itinerator_user_email=([^;]+)/);

    if (sessionMatch) {
      sessionValue = sessionMatch[1];
      console.log('✅ Found itinerator_session:', sessionValue);
    }
    if (emailMatch) {
      emailValue = emailMatch[1];
      console.log('✅ Found itinerator_user_email:', emailMatch[1]);
      console.log('   Decoded:', decodeURIComponent(emailMatch[1]));
    }
  }

  // Construct cookie string
  if (!emailValue) {
    emailValue = encodeURIComponent(email);
    console.log('\n⚠️  Email cookie not found, constructing manually:', emailValue);
  }

  const cookieString = `itinerator_session=${sessionValue}; itinerator_user_email=${emailValue}`;
  console.log('\n🍪 Cookie string to send:', cookieString);

  // 3. Test creating itinerary with cookies
  console.log('\n3️⃣ Testing POST /api/v1/itineraries with cookies...\n');

  const createResponse = await fetch(`${baseUrl}/api/v1/itineraries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieString
    },
    body: JSON.stringify({
      title: 'Test Itinerary',
      description: 'Testing authentication',
      draft: true,
      tripType: 'LEISURE'
    })
  });

  console.log('Status:', createResponse.status);

  if (createResponse.ok) {
    const itinerary = await createResponse.json();
    console.log('✅ Itinerary created successfully!');
    console.log('Itinerary ID:', itinerary.id);
    console.log('Owner:', itinerary.owner);
    console.log('\n✅ Authentication cookie handling is working correctly!');

    // Verify owner matches
    if (itinerary.owner === email) {
      console.log('✅ Owner matches authenticated user:', email);
    } else {
      console.log('❌ Owner mismatch!');
      console.log('   Expected:', email);
      console.log('   Got:', itinerary.owner);
    }
  } else {
    const error = await createResponse.text();
    console.log('❌ Failed to create itinerary');
    console.log('Error:', error);
  }
}

// Run test
testAuthCookies().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
