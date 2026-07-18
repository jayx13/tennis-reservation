import { readFile } from "node:fs/promises";

const baseUrl = "https://www.shisetsu.city.yokohama.lg.jp/user/";

async function test() {
  console.log("Fetching Home page...");
  const response = await fetch(baseUrl + "Home");
  const html = await response.text();
  
  const cookies = response.headers.getSetCookie();
  const cookieHeader = cookies.map(c => c.split(";")[0]).join("; ");
  
  const tokenMatch = html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : null;
  
  console.log("Token:", token);
  console.log("Cookies:", cookieHeader);
  
  if (!token) {
    console.error("Could not find token");
    return;
  }

  // Try to search by facility name
  const formData = new URLSearchParams();
  formData.append("__RequestVerificationToken", token);
  formData.append("HomeModel.SearchFacilityName", "新横浜公園");

  console.log("Searching for facility...");
  // Try to search by Date and Time
  const dateTimeFormData = new URLSearchParams();
  dateTimeFormData.append("__RequestVerificationToken", token);
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.SelectedPurposeCategory", "1");
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.SelectedPurpose", "21");
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.SelectedArea", "8");
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.SelectedSearchTarget", "1");
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.SearchDate", new Date().toLocaleDateString("ja-JP"));
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.TimeFrom", "0");
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.TimeTo", "0");
  dateTimeFormData.append("HomeModel.SearchByDateTimeModel.SelectedPlaceClassCategory", "1");

  console.log("Searching by Date and Time...");
  const dateTimeResponse = await fetch(baseUrl + "Home/SearchByDateTime", {
    method: "POST",
    body: dateTimeFormData,
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Cookie": cookieHeader
    }
  });

  const dateTimeRedirectRaw = await dateTimeResponse.text();
  console.log("Date/Time redirect raw:", dateTimeRedirectRaw);
  
  if (dateTimeRedirectRaw.includes("Information")) {
    const info = JSON.parse(dateTimeRedirectRaw).Information;
    const resultsUrl = new URL(info.replace(/^\.\//, ""), baseUrl).toString();
    console.log("Fetching Date/Time results page:", resultsUrl);
    const resultsResponse = await fetch(resultsUrl, {
      headers: { "Cookie": cookieHeader }
    });
    const resultsHtml = await resultsResponse.text();
    console.log("Results HTML length:", resultsHtml.length);
    
    await fs.writeFile("scripts/yokohama-datetime-results.html", resultsHtml);
    console.log("Saved results to scripts/yokohama-datetime-results.html");
    
    if (resultsHtml.includes("新横浜公園")) {
      console.log("Found '新横浜公園' in Date/Time results!");
    }
  }
}

test().catch(console.error);
