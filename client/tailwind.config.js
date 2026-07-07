/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: '#FDF6E3',
        navy: '#09122C',
        primary: '#F5C842',
        primarySoft: '#FAF0C0',
        pink: '#F5C8C0',
        pinkDark: '#E8A89E',
        beige: '#F0D9B5',
        beigeDark: '#e8d9b5',
        success: '#d4edda',
        successText: '#155724',
        danger: '#f8d7da',
        dangerText: '#721c24',
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}