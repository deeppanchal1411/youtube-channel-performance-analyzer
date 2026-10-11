import { useState } from "react";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

const API_URL = "http://localhost:5000";

function formatNumber(number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
}

function App() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeChannel = async (event) => {
    event.preventDefault();

    if (!query.trim()) {
      setError("Please enter a channel name or ID.");
      return;
    }

    setLoading(true);
    setError("");
    setData(null);

    try {
      const response = await axios.get(`${API_URL}/api/analyze`, {
        params: { query: query.trim() },
      });

      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to connect to the server.",
      );
    } finally {
      setLoading(false);
    }
  };

  const videos = data?.videos || [];

  const averageViews = videos.length
    ? videos.reduce((sum, video) => sum + video.views, 0) / videos.length
    : 0;

  const totalVideoViews = videos.reduce((sum, video) => sum + video.views, 0);

  const totalEngagements = videos.reduce(
    (sum, video) => sum + video.likes + video.comments,
    0,
  );

  const engagementRate = totalVideoViews
    ? (totalEngagements / totalVideoViews) * 100
    : 0;

  const chartData = videos.map((video, index) => ({
    name: `Video ${index + 1}`,
    title: video.title,
    views: video.views,
  }));

  function getEngagementLabel(rate) {
    if (rate >= 5) return "High";
    if (rate >= 2) return "Moderate";
    return "Low";
  }

  return (
    <div className="container py-5">
      <header className="text-center mb-4">
        <h1 className="fw-bold">YouTube Analyzer</h1>
        <p className="text-muted">
          Analyze channel performance and engagement.
        </p>
      </header>

      <form onSubmit={analyzeChannel} className="card shadow-sm p-4 mb-4">
        <label className="form-label fw-semibold">
          YouTube Channel Name or ID
        </label>

        <input
          className="form-control mb-3"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter a channel name or ID"
        />

        <button className="btn btn-danger" disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Channel"}
        </button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      {data && (
        <>
          <div className="card shadow-sm p-4 mb-4">
            <div className="d-flex align-items-center gap-3">
              {data.channel.thumbnail && (
                <img
                  src={data.channel.thumbnail}
                  alt="Channel"
                  className="channel-image"
                />
              )}

              <div>
                <h3 className="mb-1">{data.channel.title}</h3>
                <p className="text-muted mb-0">Channel Performance Overview</p>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            {[
              {
                label: "Subscribers",
                value: formatNumber(data.channel.subscribers),
              },
              {
                label: "Total Channel Views",
                value: formatNumber(data.channel.totalViews),
              },
              {
                label: "Total Videos",
                value: formatNumber(data.channel.totalVideos),
              },
              {
                label: "Average Recent Views",
                value: formatNumber(averageViews),
              },
              {
                label: "Engagement Rate",
                value: `${engagementRate.toFixed(2)}%`,
              },
              {
                label: "Engagement Level",
                value: getEngagementLabel(engagementRate),
              },
            ].map((item) => (
              <div className="col-md-4" key={item.label}>
                <div className="card shadow-sm p-4 h-100">
                  <p className="text-muted mb-2">{item.label}</p>
                  <h3 className="fw-bold mb-0">{item.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="card shadow-sm p-4 mb-4">
            <h4 className="fw-bold mb-3">Recent Video Views</h4>

            {videos.length > 0 ? (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={formatNumber} />
                    <Tooltip
                      formatter={(value) => [formatNumber(value), "Views"]}
                      labelFormatter={(label) => {
                        const item = chartData.find(
                          (video) => video.name === label,
                        );
                        return item?.title || label;
                      }}
                    />
                    <Bar dataKey="views" fill="#dc3545" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>No video data available.</p>
            )}
          </div>

          <h4 className="fw-bold mb-3">Recent Videos</h4>

          <div className="row g-3">
            {videos.map((video) => {
              const rate = video.views
                ? ((video.likes + video.comments) / video.views) * 100
                : 0;

              return (
                <div className="col-md-6" key={video.id}>
                  <div className="card shadow-sm h-100">
                    {video.thumbnail && (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="video-thumbnail"
                      />
                    )}

                    <div className="card-body">
                      <h6 className="fw-bold">{video.title}</h6>

                      <p className="mb-1">Views: {formatNumber(video.views)}</p>
                      <p className="mb-1">Likes: {formatNumber(video.likes)}</p>
                      <p className="mb-1">
                        Comments: {formatNumber(video.comments)}
                      </p>
                      <p className="mb-0">Engagement: {rate.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card shadow-sm p-4 mt-4">
            <h4 className="fw-bold">Comment Sentiment Analysis</h4>

            {data.sentiment ? (
              <>
                <p className="text-muted">Video: {data.sentiment.videoTitle}</p>
                <p>Comments analyzed: {data.sentiment.total}</p>

                {data.sentiment.total > 0 ? (
                  <>
                    <div style={{ width: "100%", height: 280 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={[
                              {
                                name: "Positive",
                                value: data.sentiment.counts.Positive,
                              },
                              {
                                name: "Neutral",
                                value: data.sentiment.counts.Neutral,
                              },
                              {
                                name: "Negative",
                                value: data.sentiment.counts.Negative,
                              },
                            ]}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={85}
                            label
                          >
                            {["#198754", "#adb5bd", "#dc3545"].map(
                              (color, index) => (
                                <Cell key={index} fill={color} />
                              ),
                            )}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {["Positive", "Neutral", "Negative"].map((label) => (
                      <div
                        key={label}
                        className="d-flex justify-content-between border-bottom py-2"
                      >
                        <span>{label}</span>
                        <strong>{data.sentiment.percentages[label]}%</strong>
                      </div>
                    ))}

                    <h5 className="mt-4">Sample Comments</h5>

                    {data.sentiment.comments.map((comment, index) => (
                      <div key={index} className="border-bottom py-2">
                        <p className="mb-1">{comment.text}</p>
                        <span
                          className={`badge ${
                            comment.sentiment === "Positive"
                              ? "bg-success"
                              : comment.sentiment === "Negative"
                                ? "bg-danger"
                                : "bg-secondary"
                          }`}
                        >
                          {comment.sentiment}
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <p>No comments are available for analysis.</p>
                )}
              </>
            ) : (
              <p className="text-muted">
                Sentiment analysis is unavailable for this video. Comments may
                be disabled.
              </p>
            )}
          </div>

          <p className="text-muted small mt-4">
            Analytics are based on the five most recent videos returned by the
            API. Engagement levels are simple project-defined categories, not
            official YouTube benchmarks.
          </p>
        </>
      )}
    </div>
  );
}

export default App;
