import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import json

#input course URL
url  = "https://us.prairielearn.com/pl/course_instance/144823/assessments"
resp = requests.get(url); resp.raise_for_status()
soup = BeautifulSoup(resp.text, "html.parser")

container = soup.find("div", class_="ita-table")
if container:
    table = container.find("table")
if not container:
    table = soup.find("table", {"class": "table table-hover table-sm"})
if not container:
    table = soup.find("table", {"class": "table table-sm table-hover"})
if not table:
    raise RuntimeError("No <table> found inside container!")

# --- Find header indices ---
header_row = table.find("tr")
headers = [th.get_text(strip=True).lower() for th in header_row.find_all("th")]
due_date_idx = None
points_idx = None
#get due date index
for i, h in enumerate(headers):
    if "due date" in h:
        due_date_idx = i
        break
    
#get points index
for i, h in enumerate(headers):
    if "points" in h:
        points_idx = i
        break

data = []
for row in table.find_all("tr")[1:]:
    cols = row.find_all("td")
    if not cols:
        continue

    # Safe extraction   
    title_cell = cols[0]
    link_tag   = title_cell.find("a")
    mp_name    = title_cell.get_text(strip=True)
    mp_link    = urljoin(url, link_tag["href"]) if link_tag and link_tag.get("href") else None

    # Use the found due date column, or fallback to empty string
    due_date = cols[due_date_idx].get_text(strip=True) if due_date_idx is not None and due_date_idx < len(cols) else "N/A"
    points   = cols[points_idx].get_text(strip=True) if due_date_idx is not None and due_date_idx < len(cols) else "N/A"
    #append to data
    data.append({
        "homework_problem": mp_name,
        "url":             mp_link,
        "due_date":        due_date,
        "points":          points
    })

#output to json
output_path = "homework_schedule.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Wrote {len(data)} records to {output_path}")