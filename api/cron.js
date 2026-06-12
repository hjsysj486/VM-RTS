// api/cron.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // 여기에 추후 Firebase DB에서 오늘 날짜의 알림 대상을 조회하는 로직이 들어갑니다.

  // 이메일 발송기 설정 (비즈비 SMTP 적용)
  const transporter = nodemailer.createTransport({
    host: 'api.mail.bizbee.co.kr',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER, // Vercel 환경변수에서 가져옴
      pass: process.env.EMAIL_PASS  // Vercel 환경변수에서 가져옴
    }
  });

  try {
    await transporter.sendMail({
      from: '"VM-RTS 알리미" <agathos902@valuemark.co.kr>',
      to: 'agathos902@valuemark.co.kr', // 임시로 본인 이메일로 테스트
      subject: '[VM-RTS] 오늘의 리크루팅 일정 알림',
      text: '시스템에 설정된 오늘의 리크루팅 일정이 있습니다. 접속하여 확인해주세요.'
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}