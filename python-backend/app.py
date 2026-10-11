import os
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from googleapiclient.discovery import build
from nltk.sentiment import SentimentIntensityAnalyzer

load_dotenv()

app = Flask(__name__)
CORS(app)

API_KEY = os.getenv("YOUTUBE_API_KEY")

def get_youtube_service():
    if not API_KEY:
        raise ValueError("YouTube API key is missing from .env")

    return build("youtube", "v3", developerKey=API_KEY)

@app.get("/")
def home():
    return jsonify({"message": "Python YouTube Analyzer API is running!"})

@app.get("/api/analyze")
def analyze_channel():
    query = request.args.get("query", "").strip()

    if not query:
        return jsonify({"message": "Enter a channel name or ID."}), 400

    try:
        youtube = get_youtube_service()

        # Find the channel
        if query.startswith("UC") and len(query) == 24:
            search_result = youtube.channels().list(
                part="snippet,statistics,contentDetails",
                id=query
            ).execute()

            channel = (
                search_result["items"][0]
                if search_result.get("items")
                else None
            )
        else:
            search_result = youtube.search().list(
                part="snippet",
                type="channel",
                q=query,
                maxResults=1
            ).execute()

            channel_id = (
                search_result["items"][0]["id"]["channelId"]
                if search_result.get("items")
                else None
            )

            channel_result = youtube.channels().list(
                part="snippet,statistics,contentDetails",
                id=channel_id
            ).execute() if channel_id else {"items": []}

            channel = (
                channel_result["items"][0]
                if channel_result.get("items")
                else None
            )

        if not channel:
            return jsonify({"message": "Channel not found."}), 404

        stats = channel["statistics"]
        snippet = channel["snippet"]
        uploads_id = channel["contentDetails"]["relatedPlaylists"]["uploads"]

        # Retrieve five recent uploads
        playlist = youtube.playlistItems().list(
            part="snippet",
            playlistId=uploads_id,
            maxResults=5
        ).execute()

        video_ids = [
            item["snippet"]["resourceId"]["videoId"]
            for item in playlist.get("items", [])
        ]

        video_items = []

        if video_ids:
            result = youtube.videos().list(
                part="snippet,statistics",
                id=",".join(video_ids)
            ).execute()

            for video in result.get("items", []):
                video_stats = video.get("statistics", {})
                video_snippet = video["snippet"]

                video_items.append({
                    "id": video["id"],
                    "title": video_snippet["title"],
                    "thumbnail": video_snippet.get("thumbnails", {}).get(
                        "medium", {}
                    ).get("url"),
                    "publishedAt": video_snippet.get("publishedAt"),
                    "views": int(video_stats.get("viewCount", 0)),
                    "likes": int(video_stats.get("likeCount", 0)),
                    "comments": int(video_stats.get("commentCount", 0))
                })

        # Calculate analytics with Pandas and NumPy
        df = pd.DataFrame(video_items)

        if not df.empty:
            df["engagementRate"] = np.where(
                df["views"] > 0,
                (df["likes"] + df["comments"]) / df["views"] * 100,
                0
            )

            average_views = float(df["views"].mean())
            total_views = int(df["views"].sum())
            total_engagements = int(
                (df["likes"] + df["comments"]).sum()
            )

            overall_rate = (
                total_engagements / total_views * 100
                if total_views else 0
            )

            videos = df.replace(
                [np.inf, -np.inf], 0
            ).fillna(0).to_dict(orient="records")

            # Return regular Python values for JSON serialization
            for video in videos:
                video["views"] = int(video["views"])
                video["likes"] = int(video["likes"])
                video["comments"] = int(video["comments"])
                video["engagementRate"] = round(
                    float(video["engagementRate"]), 2
                )
        else:
            average_views = 0
            overall_rate = 0
            videos = []
        
        # Sentiment analysis of comments from the latest video
        sentiment_data = None

        if videos:
            try:
                comment_response = youtube.commentThreads().list(
                    part="snippet",
                    videoId=videos[0]["id"],
                    maxResults=100,
                    textFormat="plainText"
                ).execute()

                analyzer = SentimentIntensityAnalyzer()
                comments = []

                for item in comment_response.get("items", []):
                    text = item["snippet"]["topLevelComment"][
                        "snippet"
                    ]["textDisplay"]

                    score = analyzer.polarity_scores(text)["compound"]

                    if score >= 0.05:
                        label = "Positive"
                    elif score <= -0.05:
                        label = "Negative"
                    else:
                        label = "Neutral"

                    comments.append({
                        "text": text,
                        "sentiment": label
                    })

                counts = {
                    "Positive": 0,
                    "Neutral": 0,
                    "Negative": 0
                }

                for comment in comments:
                    counts[comment["sentiment"]] += 1

                total = len(comments)

                percentages = {
                    label: round(count / total * 100, 1)
                    if total else 0
                    for label, count in counts.items()
                }

                sentiment_data = {
                    "videoTitle": videos[0]["title"],
                    "total": total,
                    "counts": counts,
                    "percentages": percentages,
                    "comments": comments[:10]
                }

            except Exception as error:
                # Comments can be disabled or inaccessible.
                app.logger.warning(
                    "Comment analysis unavailable: %s", error
                )

        return jsonify({
            "channel": {
                "id": channel["id"],
                "title": snippet["title"],
                "thumbnail": snippet.get("thumbnails", {}).get(
                    "medium", {}
                ).get("url"),
                "subscribers": int(stats.get("subscriberCount", 0)),
                "totalViews": int(stats.get("viewCount", 0)),
                "totalVideos": int(stats.get("videoCount", 0))
            },
            "videos": videos,
            "analytics": {
                "averageViews": round(average_views, 2),
                "engagementRate": round(overall_rate, 2)
            },
            "sentiment": sentiment_data
        })

    except Exception as error:
        app.logger.exception("Channel analysis failed")
        return jsonify({
            "message": "Analysis failed. Check the API key, quota, and server logs."
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)