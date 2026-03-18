import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(request: Request) {
    try {
        const { to, subject, html, qrData, participantName, participantId } = await request.json();

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions: any = {
            from: `"Vishaka Events" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        };

        // If we are given QR data, generate a PDF and attach it
        if (qrData) {
            try {
                // Generate QR code and fetch it
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
                const qrResponse = await fetch(qrUrl);
                const qrBuffer = Buffer.from(await qrResponse.arrayBuffer());

                // Create PDF
                const pdfDoc = await PDFDocument.create();
                const page = pdfDoc.addPage([400, 600]);
                const { width, height } = page.getSize();
                
                const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                const helveticaRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

                // Draw header
                page.drawText('Ugadi Utsav 2K26 - Entry Pass', {
                    x: 50,
                    y: height - 80,
                    size: 20,
                    font: helveticaFont,
                    color: rgb(0.85, 0.46, 0.02), // similar to #d97706
                });

                // Name and ID
                page.drawText(`Name: ${participantName || 'Guest'}`, {
                    x: 50,
                    y: height - 130,
                    size: 16,
                    font: helveticaRegular,
                    color: rgb(0.2, 0.2, 0.2),
                });

                page.drawText(`ID: ${participantId || 'N/A'}`, {
                    x: 50,
                    y: height - 160,
                    size: 16,
                    font: helveticaRegular,
                    color: rgb(0.2, 0.2, 0.2),
                });

                // Timings & Notice
                page.drawText('Important Schedule:', {
                    x: 50,
                    y: height - 200,
                    size: 14,
                    font: helveticaFont,
                    color: rgb(0.7, 0.4, 0.0),
                });

                page.drawText('- Games Start: 2:00 PM (18-03-2026)', {
                    x: 60,
                    y: height - 225,
                    size: 11,
                    font: helveticaRegular,
                    color: rgb(0.2, 0.2, 0.2),
                });

                page.drawText('- Event Starts: 9:00 AM (19-03-2026)', {
                    x: 60,
                    y: height - 245,
                    size: 11,
                    font: helveticaRegular,
                    color: rgb(0.2, 0.2, 0.2),
                });

                page.drawText('Notice: Participants should participate in the games.', {
                    x: 50,
                    y: height - 275,
                    size: 10,
                    font: helveticaFont,
                    color: rgb(0.8, 0.1, 0.1),
                });

                // Draw QR Code Image
                const qrImage = await pdfDoc.embedPng(qrBuffer);
                const qrDims = qrImage.scale(1.0);
                
                // Draw a border for QR code
                page.drawRectangle({
                    x: (width - qrDims.width) / 2 - 5,
                    y: height - 540 - 5,
                    width: qrDims.width + 10,
                    height: qrDims.height + 10,
                    borderColor: rgb(0.96, 0.62, 0.04), // similar to #f59e0b
                    borderWidth: 2,
                });

                page.drawImage(qrImage, {
                    x: (width - qrDims.width) / 2,
                    y: height - 540,
                    width: qrDims.width,
                    height: qrDims.height,
                });

                const pdfBytes = await pdfDoc.save();
                const pdfBuffer = Buffer.from(pdfBytes);

                mailOptions.attachments = [
                    {
                        filename: `${participantId || 'Entry'}_Pass.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    }
                ];
            } catch (pdfErr) {
                console.error("Error generating PDF:", pdfErr);
            }
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
        console.error('Error sending email:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
