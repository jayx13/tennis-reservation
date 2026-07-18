import { writeFile } from "node:fs/promises";

const baseUrl = "https://www.shisetsu.city.yokohama.lg.jp/user/";

async function test() {
  console.log("Fetching Home page...");
  const response = await fetch(baseUrl + "Home");
  const html = await response.text();
  
  const cookies = response.headers.getSetCookie();
  const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");
  const tokenMatch = html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : null;

  if (!token) throw new Error("No token");

  const formData = new URLSearchParams();
  formData.append("__RequestVerificationToken", token);
  
  // Basic search parameters
  const today = new Date();
  const dateFrom = new Date(today);
  dateFrom.setDate(today.getDate() + 1); // Tomorrow
  const dateTo = new Date(today);
  dateTo.setDate(today.getDate() + 30); // 30 days later
  
  const dateFromStr = dateFrom.toISOString().slice(0, 10).replace(/-/g, "/");
  const dateToStr = dateTo.toISOString().slice(0, 10).replace(/-/g, "/");
  
  formData.append("HomeModel.DateFrom", dateFromStr);
  formData.append("HomeModel.DateTo", dateToStr);
  formData.append("HomeModel.TimeFrom", "0");
  formData.append("HomeModel.TimeTo", "0");
  for (let i = 1; i <= 8; i++) formData.append("HomeModel.SelectedWeekDays", i.toString());
  formData.append("HomeModel.SelectedSearchTarget", "1");
  
  // Purpose
  formData.append("HomeModel.SearchByDateTimeModel.SelectedPurposeCategory", "1");
  formData.append("HomeModel.SearchByDateTimeModel.SelectedPurpose", "35"); // Tennis
  
  // Area
  formData.append("HomeModel.SearchByDateTimeModel.SelectedArea", "8"); // Kohoku-ku
  
  // Hidden fields
  formData.append("HomeModel.SearchByDateTimeModel.SelectedPurposeCategory", "1");
  formData.append("HomeModel.SearchByDateTimeModel.SelectedPlaceClassCategory", "1");
  formData.append("HomeModel.SelectedSearchTarget", "1");

  console.log("Searching by Date/Time...");
  const searchResponse = await fetch(baseUrl + "Home/SearchByDateTime", {
    method: "POST",
    body: formData,
    headers: { "X-Requested-With": "XMLHttpRequest", "Cookie": cookieHeader }
  });

  const searchResult = await searchResponse.text();
  console.log("Result:", searchResult);
  
  if (searchResult.includes("Ok")) {
    const info = JSON.parse(searchResult).Information;
    const resultsUrl = new URL(info.replace(/^\.\//, ""), baseUrl).toString();
    console.log("Fetching results page:", resultsUrl);
    const resResponse = await fetch(resultsUrl, { headers: { "Cookie": cookieHeader } });
    const resHtml = await resResponse.text();
    console.log("Results HTML length:", resHtml.length);
    await writeFile("scripts/yokohama-datetime-results.html", resHtml);
  }
}

test().catch(console.error);
