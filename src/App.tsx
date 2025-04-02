import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Session from './pages/Session';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 to-purple-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session/:sessionId" element={<Session />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;