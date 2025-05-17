"use client";
import React from "react";

import { useHandleStreamResponse } from "../utilities/runtime-helpers";

function MainComponent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedContent, setExtractedContent] = useState("");
  const [processedContent, setProcessedContent] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [analysisType, setAnalysisType] = useState("clean"); // clean, summarize, bullets, translate
  const [targetLanguage, setTargetLanguage] = useState("ar");
  const [summaryLength, setSummaryLength] = useState("medium"); // short, medium, long

  const handleStreamResponse = useHandleStreamResponse({
    onChunk: setStreamingResponse,
    onFinish: (message) => {
      setProcessedContent(message);
      setStreamingResponse("");
    },
  });

  const getAnalysisPrompt = () => {
    switch (analysisType) {
      case "clean":
        return `أنت مساعد متخصص في تحليل وتنظيف وتنسيق محتوى المقالات. قم بتنظيم المحتوى مع اتباع التنسيق التالي:
        - استخدم ### للعناوين الرئيسية
        - استخدم ## للعناوين الفرعية
        - استخدم * للنقاط المهمة
        - اترك سطر فارغ بين الفقرات
        - قم بتقسيم النص إلى فقرات قصيرة ومفهومة
        - ضع الأفكار المهمة في نقاط مرتبة
        - قم بإبراز الكلمات المهمة بين علامتي **
        - قم بإزالة الإعلانات والمحتوى غير المهم
        قم بإعادة صياغة المحتوى بشكل منظم ومفهوم مع الحفاظ على هذا التنسيق.`;
      case "summarize":
        const lengths = {
          short: "3 أسطر",
          medium: "5-7 أسطر",
          long: "10-12 سطر",
        };
        return `قم بتلخيص هذا المحتوى في ${lengths[summaryLength]} مع اتباع التنسيق التالي:
        - ابدأ بعنوان رئيسي ### يلخص الموضوع
        - قسم الملخص إلى نقاط مع علامة *
        - اختم بأهم النتائج أو التوصيات
        - ضع الكلمات المهمة بين علامتي **
        مع الحفاظ على النقاط الأساسية.`;
      case "bullets":
        return `قم بتحويل هذا المحتوى إلى نقاط منظمة مع اتباع التنسيق التالي:
        - استخدم ### للعنوان الرئيسي
        - استخدم ## للأقسام الرئيسية
        - استخدم * للنقاط الفرعية
        - ضع الكلمات المهمة بين علامتي **
        - رتب النقاط حسب الأهمية
        - اجعل كل نقطة مختصرة ومفيدة`;
      default:
        return "قم بتنظيم وتنظيف هذا المحتوى.";
    }
  };

  const translateContent = async (content) => {
    if (targetLanguage === "ar") return content;

    try {
      const response = await fetch(
        "/integrations/google-translate/language/translate/v2",
        {
          method: "POST",
          body: new URLSearchParams({
            q: content,
            target: targetLanguage,
            source: "ar",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("فشل في ترجمة المحتوى");
      }

      const data = await response.json();
      return data.data.translations[0].translatedText;
    } catch (err) {
      console.error("خطأ في الترجمة:", err);
      setError("فشل في ترجمة المحتوى");
      return content;
    }
  };

  const extractContent = async () => {
    if (!url) {
      setError("الرجاء إدخال رابط صحيح");
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedContent("");
    setProcessedContent("");

    try {
      // Extract content from the URL
      const scrapeResponse = await fetch("/integrations/web-scraping/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, getText: true }),
      });

      if (!scrapeResponse.ok) {
        throw new Error("فشل في استخراج المحتوى من الموقع");
      }

      const rawContent = await scrapeResponse.text();
      setExtractedContent(rawContent);

      // Process content with ChatGPT
      const chatResponse = await fetch(
        "/integrations/chat-gpt/conversationgpt4",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content: getAnalysisPrompt(),
              },
              {
                role: "user",
                content: `${rawContent}`,
              },
            ],
            stream: true,
          }),
        }
      );

      if (!chatResponse.ok) {
        throw new Error("فشل في معالجة المحتوى");
      }

      handleStreamResponse(chatResponse);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const languages = [
    { code: "ar", name: "العربية" },
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
    { code: "es", name: "Español" },
    { code: "de", name: "Deutsch" },
  ];

  const formatContent = (content) => {
    // تحويل علامات الماركداون إلى تنسيق HTML
    return content
      .split("\n")
      .map((line) => {
        if (line.startsWith("### ")) {
          return `<h1 className="text-2xl font-bold mb-4 mt-6">${line.replace(
            "### ",
            ""
          )}</h1>`;
        }
        if (line.startsWith("## ")) {
          return `<h2 className="text-xl font-semibold mb-3 mt-4">${line.replace(
            "## ",
            ""
          )}</h2>`;
        }
        if (line.startsWith("* ")) {
          return `<li className="mb-2 list-disc mr-6">${line.replace(
            "* ",
            ""
          )}</li>`;
        }
        if (line.trim() === "") {
          return "<br/>";
        }
        // تنسيق الكلمات المهمة
        const formattedLine = line.replace(
          /\*\*(.*?)\*\*/g,
          '<strong className="text-blue-700">$1</strong>'
        );
        return `<p className="mb-3">${formattedLine}</p>`;
      })
      .join("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          استخراج وتحليل محتوى المواقع
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="أدخل رابط الموقع هنا"
                className="flex-1 p-3 border border-gray-300 rounded-lg text-right"
                dir="rtl"
              />
              <button
                onClick={extractContent}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {loading ? "جاري المعالجة..." : "استخراج المحتوى"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-right mb-2 text-gray-700">
                  نوع التحليل:
                </label>
                <select
                  value={analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  dir="rtl"
                >
                  <option value="clean">تنظيف وتنظيم المحتوى</option>
                  <option value="summarize">تلخيص المحتوى</option>
                  <option value="bullets">تحويل لنقاط مرقمة</option>
                </select>
              </div>

              {analysisType === "summarize" && (
                <div>
                  <label className="block text-right mb-2 text-gray-700">
                    طول الملخص:
                  </label>
                  <select
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-right"
                    dir="rtl"
                  >
                    <option value="short">ملخص قصير</option>
                    <option value="medium">ملخص متوسط</option>
                    <option value="long">ملخص مطول</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-right mb-2 text-gray-700">
                  لغة المخرجات:
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-right"
                  dir="rtl"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg text-right">
              {error}
            </div>
          )}

          {extractedContent && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3 text-right">
                المحتوى الأصلي:
              </h2>
              <div
                className="bg-gray-50 p-4 rounded-lg text-right leading-relaxed"
                dir="rtl"
              >
                {extractedContent}
              </div>
            </div>
          )}

          {(streamingResponse || processedContent) && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-3 text-right">
                المحتوى المعالج:
              </h2>
              <div
                className="bg-gray-50 p-6 rounded-lg text-right leading-relaxed prose prose-lg max-w-none"
                dir="rtl"
                dangerouslySetInnerHTML={{
                  __html: formatContent(streamingResponse || processedContent),
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MainComponent;