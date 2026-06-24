const { Resend } = require('resend')

async function sendOtpEmail(to, otp) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const { data, error } = await resend.emails.send({
        from: 'JukeBox <onboarding@resend.dev>',
        to,
        subject: 'Your JukeBox verification code',
        html: `<p>Your JukeBox verification code is <b>${otp}</b>.</p>
           <p>It expires in 10 minutes. If this wasn't you, ignore this email.</p>`,
    })
    if (error) {
        console.error('Resend error:', error)
        throw new Error(error.message)
    }
    console.log('Email sent:', data?.id)
    return data
}

module.exports = { sendOtpEmail }