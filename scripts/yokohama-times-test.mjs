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

  // 1. Search by facility name
  const formData = new URLSearchParams();
  formData.append("__RequestVerificationToken", token);
  formData.append("HomeModel.SearchFacilityName", "新横浜公園");

  console.log("Searching for facility...");
  const searchResponse = await fetch(baseUrl + "Home/SearchByFacilityName", {
    method: "POST",
    body: formData,
    headers: { "X-Requested-With": "XMLHttpRequest", "Cookie": cookieHeader }
  });

  const redirectPath = (await searchResponse.text()).replace(/^"|"$/g, "");
  
  // 2. Select facility
  const selectUrl = new URL(redirectPath.replace(/^\.\//, ""), baseUrl).toString();
  const selectResponse = await fetch(selectUrl, { headers: { "Cookie": cookieHeader } });
  
  const selectFormData = new URLSearchParams();
  selectFormData.append("__RequestVerificationToken", token);
  selectFormData.append("SelectFacilities.Facilities[0].IsChecked", "true");
  selectFormData.append("SelectFacilities.Facilities[0].SelectedFacility.Value", "47");
  selectFormData.append("SelectFacilities.Facilities[0].SelectedFacility.Text", "新横浜公園");

  console.log("Selecting facility...");
  const selectNextResponse = await fetch(baseUrl + "AvailabilityCheckApplySelectFacility/Next", {
    method: "POST",
    body: selectFormData,
    headers: { "X-Requested-With": "XMLHttpRequest", "Cookie": cookieHeader }
  });

  const selectNextRedirect = JSON.parse(await selectNextResponse.text()).Information;

  // 3. Select day
  const daysUrl = new URL(selectNextRedirect.replace(/^\.\//, ""), baseUrl).toString();
  await fetch(daysUrl, { headers: { "Cookie": cookieHeader } });

  const dayFormData = new URLSearchParams();
  dayFormData.append("__RequestVerificationToken", token);
  dayFormData.append("SearchCondition.StartDate", "2026-06-16");
  dayFormData.append("SearchCondition.DisplayTerm", "2");
  dayFormData.append("SearchCondition.DisplayCalendar", "0");
  dayFormData.append("SearchCondition.TimeZone", "0");
  dayFormData.append("SelectDays.Rows[0].Cells[2].IsChecked", "true");

  console.log("Selecting day...");
  const dayNextResponse = await fetch(baseUrl + "AvailabilityCheckApplySelectDays/Next", {
    method: "POST",
    body: dayFormData,
    headers: { "X-Requested-With": "XMLHttpRequest", "Cookie": cookieHeader }
  });

  const dayNextText = await dayNextResponse.text();
  console.log("Day next response:", dayNextText);
  const dayNextResult = JSON.parse(dayNextText);
  
  if (dayNextResult.Result !== "Ok") {
    console.error("Failed to proceed from days to times:", dayNextResult.Information);
    return;
  }
  
  const dayNextRedirect = dayNextResult.Information;

  // 4. Get times
  const timesUrl = new URL(dayNextRedirect.replace(/^\.\//, ""), baseUrl).toString();
  console.log("Fetching times page:", timesUrl);
  const timesResponse = await fetch(timesUrl, { headers: { "Cookie": cookieHeader } });
  const timesHtml = await timesResponse.text();
  
  await writeFile("scripts/yokohama-times.html", timesHtml);
  console.log("Saved times HTML. Extracting data...");
  
  const jsonMatch = timesHtml.match(/JSON\.parse\("([^"]+)"\)/g);
  if (jsonMatch) {
    for (const match of jsonMatch) {
        const jsonStr = match.slice(12, -2).replace(/\\u([0-9a-fA-F]{4})/g, (m, p1) => String.fromCharCode(parseInt(p1, 16)));
        try {
            const data = JSON.parse(jsonStr);
            if (data.SelectTimes) {
                console.log("Found SelectTimes data!");
                await writeFile("scripts/yokohama-times.json", JSON.stringify(data, null, 2));
                break;
            }
        } catch (e) {}
    }
  }
}

test().catch(console.error);
