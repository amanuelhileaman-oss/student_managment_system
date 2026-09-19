const path = require('path');
const upload = require('../src/middleware/upload');
const materialUpload = require('../src/middleware/materialUpload');
const { uploadBuffer, getSignedDownloadUrl } = require('../src/services/cloudinaryService');

const runTests = async () => {
  console.log('====================================================');
  console.log('STARTING CROSS-DEVICE & PRODUCTION FILE VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const testFileFilter = (filterFn, filterName, fileObj, shouldPass) => {
    return new Promise((resolve) => {
      filterFn({}, fileObj, (err, accepted) => {
        if (shouldPass) {
          if (!err && accepted) {
            console.log(`[PASS] ${filterName}: Accepted "${fileObj.originalname}" (${fileObj.mimetype}) -> Resulting Name: "${fileObj.originalname}"`);
            passed++;
          } else {
            console.error(`[FAIL] ${filterName}: Expected pass for "${fileObj.originalname}", but got error:`, err?.message);
            failed++;
          }
        } else {
          if (err) {
            console.log(`[PASS] ${filterName}: Successfully rejected "${fileObj.originalname}": ${err.message}`);
            passed++;
          } else {
            console.error(`[FAIL] ${filterName}: Expected reject for "${fileObj.originalname}", but was accepted!`);
            failed++;
          }
        }
        resolve();
      });
    });
  };

  // Test 1: Upload filter (Assignments & Submissions)
  console.log('--- 1. Testing Assignment Upload Filter ---');
  const uploadFilter = upload.fileFilter;

  await testFileFilter(uploadFilter, 'upload', { originalname: 'Biology_Report.pdf', mimetype: 'application/pdf' }, true);
  await testFileFilter(uploadFilter, 'upload', { originalname: 'Math Homework (Draft 2) [Final].docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, true);
  await testFileFilter(uploadFilter, 'upload', { originalname: 'Presentation.pptx', mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }, true);
  await testFileFilter(uploadFilter, 'upload', { originalname: 'Data.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, true);
  await testFileFilter(uploadFilter, 'upload', { originalname: 'IMG_20240919_WA0004.jpeg', mimetype: 'image/jpeg' }, true);
  // Android without extension:
  await testFileFilter(uploadFilter, 'upload', { originalname: 'Android_Download_No_Ext', mimetype: 'application/pdf' }, true);
  await testFileFilter(uploadFilter, 'upload', { originalname: 'Android_Octet_Stream', mimetype: 'application/octet-stream' }, true);
  // Invalid format:
  await testFileFilter(uploadFilter, 'upload', { originalname: 'malicious.exe', mimetype: 'application/x-msdownload' }, false);

  // Test 2: Material Upload Filter (Textbooks & Large Books)
  console.log('\n--- 2. Testing Study Material Upload Filter ---');
  const matFilter = materialUpload.fileFilter;
  await testFileFilter(matFilter, 'materialUpload', { originalname: 'Chemistry_Grade_10_Textbook.pdf', mimetype: 'application/pdf' }, true);
  await testFileFilter(matFilter, 'materialUpload', { originalname: 'History_Notes_Epub.epub', mimetype: 'application/epub+zip' }, true);
  await testFileFilter(matFilter, 'materialUpload', { originalname: 'Lecture_Slides.pptx', mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }, true);
  await testFileFilter(matFilter, 'materialUpload', { originalname: 'Android_WhatsApp_Doc', mimetype: 'application/pdf' }, true);
  await testFileFilter(matFilter, 'materialUpload', { originalname: 'system.bat', mimetype: 'application/x-bat' }, false);

  // Test 3: Cloudinary Upload & Signed URL Streaming with Complex Filename
  console.log('\n--- 3. Testing Cloudinary Upload Buffer & Sanitization ---');
  try {
    const dummyBuffer = Buffer.from('%PDF-1.4 Mock Cross-Device Production Document Header %EOF');
    const complexFilename = 'Physics Lab Report (Grade 9) [Special Edition] #1.pdf';
    const uploadRes = await uploadBuffer(dummyBuffer, {
      folder: 'ethio_highhub/test_verification',
      originalName: complexFilename,
      resourceType: 'auto',
    });

    console.log(`[PASS] Uploaded to Cloudinary with complex name: ${uploadRes.public_id}`);
    console.log(`       Secure URL: ${uploadRes.secure_url}`);
    passed++;

    const signedUrl = getSignedDownloadUrl(uploadRes.secure_url);
    console.log(`[PASS] Signed download URL generated successfully: ${signedUrl ? 'Valid URL' : 'Empty'}`);
    passed++;

    const fetchRes = await fetch(signedUrl);
    if (fetchRes.ok) {
      const data = await fetchRes.arrayBuffer();
      console.log(`[PASS] Streamed binary from Cloudinary: HTTP ${fetchRes.status}, received ${data.byteLength} bytes`);
      passed++;
    } else {
      console.error(`[FAIL] Cloudinary fetch returned status ${fetchRes.status}`);
      failed++;
    }
  } catch (err) {
    console.error('[FAIL] Cloudinary verification error:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
