const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== Testing Chat Edit, Delete & Authorization ===');

  try {
    // 1. Login as teacher
    const teacherLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'teacher.math@highschool.edu',
        password: 'Teacher@123',
      }),
    });
    if (!teacherLogin.ok) throw new Error('Teacher login failed: ' + JSON.stringify(teacherLogin.data));
    const teacherToken = teacherLogin.data.token || teacherLogin.data.data?.token;
    const teacherUser = teacherLogin.data.user || teacherLogin.data.data?.user;
    console.log(`✓ Teacher logged in: ${teacherUser.firstName} ${teacherUser.lastName} (ID: ${teacherUser.id})`);

    // 2. Login as student
    const studentLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'student.g10.natural@highschool.edu',
        password: 'Student@123',
      }),
    });
    if (!studentLogin.ok) throw new Error('Student login failed: ' + JSON.stringify(studentLogin.data));
    const studentToken = studentLogin.data.token || studentLogin.data.data?.token;
    const studentUser = studentLogin.data.user || studentLogin.data.data?.user;
    console.log(`✓ Student logged in: ${studentUser.firstName} ${studentUser.lastName} (ID: ${studentUser.id})`);

    // 3. Login as admin
    const adminLogin = await req(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: 'aman12@gmail.com',
        password: 'aman1221',
      }),
    });
    if (!adminLogin.ok) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
    const adminToken = adminLogin.data.token || adminLogin.data.data?.token;
    console.log(`✓ Admin logged in`);

    // 4. Start/get conversation between teacher and student
    const convRes = await req(`${API_BASE}/communications/conversations/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ recipientId: studentUser.id }),
    });
    const conv = convRes.data.data;
    const convId = conv.id;
    console.log(`✓ Conversation established: ID ${convId}`);

    // 5. Teacher sends message
    const sendRes = await req(`${API_BASE}/communications/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        conversationId: convId,
        content: 'Original message: Please submit your mathematics homework tomorrow.',
      }),
    });
    if (!sendRes.ok) throw new Error('Send message failed: ' + JSON.stringify(sendRes.data));
    const msgId = sendRes.data.data.id;
    console.log(`✓ Teacher sent message: ID ${msgId}, Content: "${sendRes.data.data.content}"`);

    // 6. Teacher edits own message
    const editRes = await req(`${API_BASE}/communications/messages/${msgId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        content: 'Edited message: Please submit your mathematics homework tomorrow by 10:00 AM.',
      }),
    });
    if (!editRes.ok) throw new Error('Edit message failed: ' + JSON.stringify(editRes.data));
    console.log(`✓ Message edited successfully: is_edited = ${editRes.data.data.is_edited}`);
    if (editRes.data.data.is_edited !== true) {
      throw new Error('Expected is_edited to be true');
    }

    // 7. Student fetches messages and sees edited message
    const getMsgsRes = await req(`${API_BASE}/communications/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const foundMsg = getMsgsRes.data.data.find((m) => m.id === msgId);
    if (!foundMsg) throw new Error('Message not found by student');
    console.log(`✓ Student verified message: content = "${foundMsg.content}", is_edited = ${foundMsg.is_edited}`);

    // 8. Student tries to edit teacher's message (MUST FAIL with 403)
    const unauthorizedEdit = await req(`${API_BASE}/communications/messages/${msgId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ content: 'Unauthorized tampering' }),
    });
    if (unauthorizedEdit.status === 403) {
      console.log('✓ Security check passed: Student cannot edit teacher message (HTTP 403 Forbidden)');
    } else {
      throw new Error('SECURITY VIOLATION: Student was able to edit teacher message! Status: ' + unauthorizedEdit.status);
    }

    // 9. Teacher deletes the message
    const delRes = await req(`${API_BASE}/communications/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    if (!delRes.ok) throw new Error('Delete message failed: ' + JSON.stringify(delRes.data));
    console.log(`✓ Teacher successfully deleted message ID ${msgId}`);

    // Verify message is gone
    const verifyDel = await req(`${API_BASE}/communications/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    if (verifyDel.data.data.some((m) => m.id === msgId)) {
      throw new Error('Message was not deleted from database');
    }
    console.log('✓ Verified message is completely removed from conversation feed');

    // 10. Teacher sends another message, and Admin deletes it (Admin Moderation)
    const send2 = await req(`${API_BASE}/communications/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        conversationId: convId,
        content: 'Second message to test admin moderation deletion.',
      }),
    });
    const msg2Id = send2.data.data.id;
    console.log(`✓ Teacher sent second message ID ${msg2Id}`);

    const adminDel = await req(`${API_BASE}/communications/messages/${msg2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!adminDel.ok) throw new Error('Admin delete failed: ' + JSON.stringify(adminDel.data));
    console.log(`✓ Admin successfully deleted message ID ${msg2Id} (Moderation Authority verified)`);

    console.log('\n=== ALL CHAT EDIT, DELETE & REFRESH TESTS PASSED! ===\n');
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

runTests();
