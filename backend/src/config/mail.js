import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const mailConfig = {
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: process.env.MAIL_SECURE === "true",
  connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT || 5000),
  greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT || 5000),
  socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT || 8000)
};

if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  mailConfig.auth = {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  };
}

const transporter = nodemailer.createTransport(mailConfig);

export default transporter;
