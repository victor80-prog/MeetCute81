module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#ff4d94',
        'primary-light': '#ff7eb3',
        'primary-dark': '#e04484',
        secondary: '#ffb6c1',
        accent: '#ffd1dc',
        dark: '#3a0f3b',
        light: '#fff9fb',
        text: '#333333',
        'text-light': '#666666',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}