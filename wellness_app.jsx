/*
WellnessApp.jsx
Single-file React component for a responsive wellness app prototype.

Dependencies:
- React 18+
- Tailwind CSS configured in your project (optional but used here for styling)
- recharts (for trend visualization): npm install recharts

How to use:
1. Create a React app (Vite / CRA / Next.js). Ensure Tailwind is setup or remove Tailwind classes.
2. Add `npm install recharts`
3. Place this file at src/WellnessApp.jsx and import it in src/App.jsx: `import WellnessApp from './WellnessApp'` and render <WellnessApp />.

Notes:
- This is a client-only prototype using localStorage for persistence.
- Sentiment analysis is a simple on-device heuristic for demo purposes. Replace with a server or ML model for production.
- Recommendations are rule-based and configurable.
*/

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const STORAGE_KEY = 'wellness_checkins_v1';

// Very simple sentiment function (demo). Returns score -1..1 and label.
function analyzeSentiment(text, moodValue) {
  // small lexicon
  const positives = ['good', 'great', 'happy', 'joy', 'excited', 'calm', 'content', 'relieved'];
  const negatives = ['sad', 'depressed', 'anxious', 'stressed', 'angry', 'mad', 'tired', 'lonely'];

  const normalized = text.toLowerCase();
  let score = 0;
  positives.forEach((w) => { if (normalized.includes(w)) score += 0.4; });
  negatives.forEach((w) => { if (normalized.includes(w)) score -= 0.4; });

  // Factor in self-reported moodValue (-2..2)
  score += moodValue * 0.2;

  // clamp
  if (score > 1) score = 1;
  if (score < -1) score = -1;

  const label = score > 0.2 ? 'Positive' : score < -0.2 ? 'Negative' : 'Neutral';
  return { score, label };
}

function getRecommendationFromScore(score, lastEntry) {
  // simple rules for recommendations
  if (score <= -0.6) {
    return {
      title: 'Consider reaching out for support',
      desc: 'Your recent check-ins show a strong negative sentiment. Consider contacting a friend, family member, or a professional. If you are in immediate danger, contact emergency services.',
      urgency: 'high',
    };
  }
  if (score <= -0.2) {
    return {
      title: 'Try a grounding or breathing exercise',
      desc: 'Short breathing exercises (4-4-4) for 5 minutes can reduce anxiety. Also consider a brief walk and hydration.',
      urgency: 'medium',
    };
  }
  if (score <= 0.2) {
    return {
      title: 'Do a short mood-boosting activity',
      desc: 'Try a 10-minute guided meditation, listen to an uplifting playlist, or write three things you’re grateful for.',
      urgency: 'low',
    };
  }
  return {
    title: 'Keep up the good work!',
    desc: 'Your recent mood looks positive. Continue routines that support your wellbeing and consider journaling to capture what is working.',
    urgency: 'none',
  };
}

function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

export default function WellnessApp() {
  const [checkins, setCheckins] = useState([]);
  const [moodValue, setMoodValue] = useState(0); // -2 .. 2
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()));
  const [filterRange, setFilterRange] = useState(30);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setCheckins(JSON.parse(raw));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkins));
  }, [checkins]);

  function handleSubmit(e) {
    e.preventDefault();
    const date = selectedDate;
    const existingIndex = checkins.findIndex((c) => c.date === date);

    const sentiment = analyzeSentiment(note, moodValue);

    const entry = {
      date,
      moodValue,
      note,
      sentimentScore: sentiment.score,
      sentimentLabel: sentiment.label,
      createdAt: new Date().toISOString(),
    };

    let next;
    if (existingIndex >= 0) {
      next = [...checkins];
      next[existingIndex] = entry;
    } else {
      next = [...checkins, entry].sort((a, b) => a.date.localeCompare(b.date));
    }
    setCheckins(next);
    setNote('');
    // subtle UX: keep moodValue to let user quickly log similar mood
  }

  function handleDelete(date) {
    const next = checkins.filter((c) => c.date !== date);
    setCheckins(next);
  }

  // Prepare data for chart
  const chartData = (() => {
    // show last N days (filterRange) with filled gaps
    const days = parseInt(filterRange, 10);
    const today = new Date();
    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDateISO(d);
      const found = checkins.find((c) => c.date === key);
      arr.push({ date: key, score: found ? found.sentimentScore : null });
    }
    return arr;
  })();

  // Simple trend: average score over last 7 and last 30
  const computeAverage = (days) => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() - (days - 1));
    const relevant = checkins.filter((c) => new Date(c.date) >= cutoff);
    if (relevant.length === 0) return null;
    const avg = relevant.reduce((s, r) => s + r.sentimentScore, 0) / relevant.length;
    return Math.round(avg * 100) / 100;
  };

  const avg7 = computeAverage(7);
  const avg30 = computeAverage(30);

  // Latest recommendation uses last entry average and trend
  const latest = checkins.length ? checkins[checkins.length - 1] : null;
  const latestScore = latest ? latest.sentimentScore : 0;
  const recommendation = getRecommendationFromScore(latestScore, latest);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold">Wellness — Daily Check-ins</h1>
          <div className="text-sm text-gray-600">Local-only demo • Data stored in browser</div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: input & quick stats */}
          <section className="lg:col-span-1 bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-medium mb-2">Today's Check-in</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block text-sm">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-md border p-2"
              />

              <label className="block text-sm">Mood (–2 sad ... 0 neutral ... +2 happy)</label>
              <div className="flex gap-2 items-center">
                {[-2, -1, 0, 1, 2].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMoodValue(v)}
                    className={`px-3 py-2 rounded-md border ${moodValue === v ? 'bg-blue-600 text-white' : ''}`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              <label className="block text-sm">Short note / journal</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="How are you feeling? Anything on your mind?"
                className="w-full rounded-md border p-2"
              />

              <div className="flex gap-2">
                <button className="px-3 py-2 bg-green-600 text-white rounded-md" type="submit">Save Check-in</button>
                <button
                  type="button"
                  onClick={() => { setNote(''); setMoodValue(0); }}
                  className="px-3 py-2 border rounded-md"
                >
                  Clear
                </button>
              </div>
            </form>

            <div className="mt-4 border-t pt-3 text-sm text-gray-700">
              <div>Latest sentiment: <strong>{latest ? `${latest.sentimentLabel} (${latest.sentimentScore})` : '—'}</strong></div>
              <div className="mt-2">7-day avg: <strong>{avg7 ?? '—'}</strong></div>
              <div>30-day avg: <strong>{avg30 ?? '—'}</strong></div>

              <div className="mt-3 p-3 rounded-md bg-gray-50">
                <div className="font-medium">Recommendation</div>
                <div className="text-sm">{recommendation.title}</div>
                <div className="mt-2 text-xs text-gray-600">{recommendation.desc}</div>
              </div>
            </div>
          </section>

          {/* Middle: Chart */}
          <section className="lg:col-span-2 bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Mood Trend (sentiment score)</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm">Days</label>
                <select value={filterRange} onChange={(e) => setFilterRange(e.target.value)} className="border rounded-md p-1 text-sm">
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                  <option value={30}>30</option>
                  <option value={90}>90</option>
                </select>
              </div>
            </div>

            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                  <YAxis domain={[-1, 1]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3182ce"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4">
              <h3 className="font-medium mb-2">Recent Check-ins</h3>
              <div className="space-y-2 max-h-56 overflow-auto">
                {checkins.length === 0 && <div className="text-sm text-gray-500">No check-ins yet.</div>}
                {checkins.slice().reverse().map((c) => (
                  <div key={c.date} className="border rounded-md p-3 flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">{c.date} — {c.sentimentLabel} ({c.sentimentScore})</div>
                      <div className="text-xs text-gray-600 mt-1">Mood: {c.moodValue} • {c.note}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => { setSelectedDate(c.date); setNote(c.note); setMoodValue(c.moodValue); }} className="text-sm px-2 py-1 border rounded-md">Edit</button>
                      <button onClick={() => handleDelete(c.date)} className="text-sm px-2 py-1 border rounded-md">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-6 text-center text-xs text-gray-500">
          This prototype is not a replacement for medical advice. For emergencies, contact local emergency services.
        </footer>
      </div>
    </div>
  );
}
