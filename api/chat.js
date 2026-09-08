// Vercel Serverless Function: Upstage Solar Pro API 보안 프록시
//
// 목적(원리 3 관련 인프라 안전장치): API 키를 클라이언트(index.html)에 절대
// 내려보내지 않고, 서버 환경변수(UPSTAGE_API_KEY)에만 보관한 채로 학습자의
// 요청을 대신 Upstage API에 전달한다. 프론트엔드는 이 엔드포인트(/api/chat)만 호출한다.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "서버에 UPSTAGE_API_KEY 환경변수가 설정되어 있지 않습니다." });
    return;
  }

  const { model, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages 배열이 필요합니다." });
    return;
  }

  try {
    const upstream = await fetch("https://api.upstage.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "solar-pro",
        messages
      })
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Upstage API 호출 중 오류가 발생했습니다.", detail: String(err) });
  }
}
