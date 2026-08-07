/**
 * script.js
 * Logic cho template vibe-viral-basic
 */

document.addEventListener('DOMContentLoaded', () => {
    const submitBtn = document.getElementById('submit-btn');
    const emailInput = document.getElementById('email');
    const topicInput = document.getElementById('topic');
    const statusMsg = document.getElementById('status-message');

    if (!submitBtn) return;

    submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const topic = topicInput.value.trim();

        if (!email) {
            showStatus('Vui lòng nhập email của bạn.', 'error');
            return;
        }

        // Vô hiệu hóa nút khi đang gửi
        submitBtn.disabled = true;
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Đang gửi...</span>';

        try {
            // Sử dụng n8nBridge để gửi dữ liệu về hệ thống
            // templateId giúp backend nhận diện dữ liệu đến từ đâu
            const result = await window.n8nBridge.send({
                webhookPath: 'viral-lead-capture', // Tên webhook trong n8n
                data: {
                    email: email,
                    topic: topic,
                    template: 'vibe-viral-basic',
                    source: window.location.href
                }
            });

            if (result.success) {
                showStatus('Yêu cầu đã được gửi thành công! Chúng tôi sẽ liên hệ sớm.', 'success');
                emailInput.value = '';
                topicInput.value = '';
            } else {
                showStatus('Có lỗi xảy ra: ' + (result.error || 'Server error'), 'error');
            }
        } catch (error) {
            showStatus('Không thể kết nối đến hệ thống n8n.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
        }
    });

    function showStatus(message, type) {
        statusMsg.textContent = message;
        statusMsg.className = 'status-message status-' + type;
        statusMsg.style.display = 'block';

        // Tự động ẩn sau 5 giây nếu là thành công
        if (type === 'success') {
            setTimeout(() => {
                statusMsg.style.display = 'none';
            }, 5000);
        }
    }
});
