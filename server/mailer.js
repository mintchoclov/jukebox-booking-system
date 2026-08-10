
/*
const { Resend } = require('resend')

async function sendOtpEmail(to, otp) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const { data, error } = await resend.emails.send({
        from: 'JukeBox <noreply@jukeboxbooking.com>',
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
*/


const { Resend } = require('resend')

async function sendOtpEmail(to, otp) {
  if (process.env.EMAIL_DEV_MODE === 'true') {
    console.log('================ DEV EMAIL MODE ================')
    console.log(`To: ${to}`)
    console.log(`OTP: ${otp}`)
    console.log('This OTP is printed locally only. Do not use this in production.')
    console.log('================================================')

    return {
      id: 'dev-email-mode',
      to
    }
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY. Set EMAIL_DEV_MODE=true for local testing.')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await resend.emails.send({
    from: 'JukeBox <noreply@jukeboxbooking.com>',
    to,
    subject: 'Your JukeBox verification code',
      headers: {
          'X-Entity-Ref-ID': `jukebox-otp-${Date.now()}`,
      },
    html: `
      <p>Your JukeBox verification code is <b>${otp}</b>.</p>
      <p>It expires in 10 minutes. If this wasn't you, ignore this email.</p>
    `
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(error.message)
  }

  console.log('Email sent:', data?.id)
  return data
}

module.exports = { sendOtpEmail }