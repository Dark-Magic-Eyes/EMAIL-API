import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Gmail SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER!,
    pass: process.env.GMAIL_APP_PASS!,
  },
});

// Lưu token tạm (dev)
interface PendingToken {
  email: string;
  expiresAt: number;
}
const pendingTokens = new Map<string, PendingToken>();

// API: Gửi email xác nhận
app.post("/api/send-verification", async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Email không hợp lệ" });
  }

  try {
    // Tạo token
    const raw = `${email}|${Date.now() + Math.random()}`;
    const token = Buffer.from(raw).toString("base64url");
    const url = `${process.env.FRONTEND_URL}/complete-registration?token=${token}`;

    // Lưu token (hết hạn 15 phút)
    pendingTokens.set(token, {
      email,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    // Gửi email
    await transporter.sendMail({
      from: `"AtomHub" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "AtomHub – Xác nhận đăng ký tài khoản",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 12px; text-align: center;">
          <h2 style="color: #f9b000; margin-bottom: 16px;">Hoàn tất đăng ký</h2>
          <p style="margin-bottom: 24px;">Click nút để xác nhận email:</p>
          <strong style="font-size: 16px; display: block; margin: 16px 0;">${email}</strong>
          
          <a href="${url}" 
             style="display: inline-block; background: #f9b000; color: white; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0;">
            HOÀN TẤT ĐĂNG KÝ
          </a>

          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            Link hết hạn sau <strong>15 phút</strong>
          </p>

          <hr style="border: 1px solid #eee; margin: 32px 0;">
          <p style="color: #999; font-size: 12px;">
            Nếu bạn không thực hiện, bỏ qua email này.
          </p>
        </div>
      `,
    });

    console.log(`Email sent to: ${email}`);
    res.json({ success: true, message: "Đã gửi email!" });
  } catch (error: any) {
    console.error("Lỗi gửi email:", error.message);
    res.status(500).json({ error: "Gửi email thất bại" });
  }
});

// API: Xác thực token
app.get("/api/verify-token", (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token không hợp lệ" });
  }

  const data = pendingTokens.get(token);
  if (!data || Date.now() > data.expiresAt) {
    pendingTokens.delete(token);
    return res.status(410).json({ error: "Token hết hạn" });
  }

  // Xóa token sau khi dùng
  pendingTokens.delete(token);
  res.json({ email: data.email });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API đang chạy tại: http://localhost:${PORT}`);
  console.log(`Test gửi email: curl -X POST http://localhost:${PORT}/api/send-verification -d '{"email":"test@gmail.com"}' -H "Content-Type: application/json"`);
});