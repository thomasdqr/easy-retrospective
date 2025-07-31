# Easy Retrospective

A collaborative real-time retrospective tool for agile teams.

**"Grow Understanding, Explore Perspectives, Inspire Next."**

## Features

- **Real-time collaboration** - Multiple team members can participate simultaneously
- **Interactive whiteboard** - Digital sticky notes for collecting feedback
- **Team icebreakers** - Built-in activities like "Two Truths One Lie" and drawing exercises
- **Vote & prioritize** - Democratic voting system for identifying key issues
- **AI-powered summaries** - Automated insights and action items
- **User-friendly interface** - Clean, intuitive design with avatars and timers

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore + Realtime Database)
- **Build Tool**: Vite
- **Hosting**: Firebase Hosting
- **AI Integration**: Gemini API for summaries

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/easy-retrospective.git
   cd easy-retrospective
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project
   - Add your Firebase config to `src/config/firebase.ts`
   - Set up Firestore and Realtime Database

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## Deployment

Deploy to Firebase Hosting:
```bash
npm run deploy
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).