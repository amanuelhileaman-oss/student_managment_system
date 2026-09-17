const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communicationController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Announcements (Read for all, Create/Update/Delete for Admin)
router.get('/announcements', communicationController.getAnnouncements);
router.post('/announcements', requireRole(['admin']), communicationController.createAnnouncement);
router.put('/announcements/:id', requireRole(['admin']), communicationController.updateAnnouncement);
router.delete('/announcements/:id', requireRole(['admin']), communicationController.deleteAnnouncement);

// Chat & Direct Messages
router.get('/contacts', communicationController.getContacts);
router.post('/conversations/start', communicationController.startConversation);
router.get('/conversations', communicationController.getConversations);
router.get('/conversations/:conversationId/messages', communicationController.getMessages);
router.post('/messages', communicationController.sendMessage);
router.put('/messages/:messageId', communicationController.editMessage);
router.delete('/messages/:messageId', communicationController.deleteMessage);

// Notifications
router.get('/notifications', communicationController.getNotifications);
router.patch('/notifications/read-all', communicationController.markAllNotificationsRead);
router.patch('/notifications/:notificationId/read', communicationController.markNotificationRead);
router.delete('/notifications/clear-all', communicationController.clearAllNotifications);
router.delete('/notifications/:notificationId', communicationController.deleteNotification);

module.exports = router;
