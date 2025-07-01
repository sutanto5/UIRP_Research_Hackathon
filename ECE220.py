import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import json

# 1. Fetch the page
url = "https://courses.grainger.illinois.edu/ece220/sp2025/assignments/mps/"
resp = requests.get(url)
resp.raise_for_status()            # crash early if we got a bad response
html = resp.text

# 2. Parse the HTML
soup = BeautifulSoup(html, "html.parser")

# 3. Find your specific table
container = soup.find("div", class_="ita-table")
table     = container.find("table")

# 4. Grab all rows, but skip the very first <tr> (the header)
rows = table.find_all("tr")[1:]

data = []
for row in rows:
    cols = row.find_all("td")
    if not cols:
        continue

    # 5. Extract each cell’s text (and link)
    mp_cell    = cols[0].get_text(strip=True)
    link_tag   = cols[0].find("a")
    mp_link    = urljoin(url, link_tag["href"]) if link_tag else None
    due_date   = cols[1].get_text(strip=True)
    points     = cols[2].get_text(strip=True)

    data.append({
        "machine_problem": mp_cell,
        "url":             mp_link,
        "due_date":        due_date,
        "points":          points
    })

with open('data.json', 'a') as f:
    f.write(json.dumps(data, ensure_ascii=False, indent=4))

# 6. Look at what we’ve got
for item in data:
    print(item)
