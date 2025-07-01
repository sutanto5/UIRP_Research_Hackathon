import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import json

def scrape_html_table(
    page_url: str,
    table_selector: str = None,   # e.g. "div.ita-table table" or ".my‐other‐table"
    table_index: int = 0          # if selector hits multiple tables
):
    # 1) fetch & parse
    resp = requests.get(page_url)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # 2) locate your tables
    if table_selector:
        tables = soup.select(table_selector)
    else:
        tables = soup.find_all("table")

    if not tables:
        raise RuntimeError(f"No tables found with selector={table_selector!r}")

    # pick the one you want
    tbl = tables[table_index]

    # 3) read headers
    header_row = tbl.find("thead")
    if not header_row:
        # fallback: maybe the first <tr> in the body is really the header
        header_cells = tbl.find_all("tr")[0].find_all("th")
    else:
        header_cells = header_row.find_all("th")

    headers = [th.get_text(strip=True) for th in header_cells]
    if not headers:
        raise RuntimeError("No <th> headers found!")

    # 4) read data rows
    body = tbl.find("tbody") or tbl
    data = []
    for tr in body.find_all("tr"):
        cols = tr.find_all("td")
        if len(cols) < len(headers):
            # probably a separator or note row, skip it
            continue

        row = {}
        for header, td in zip(headers, cols):
            # guard #1: text
            text = td.get_text(strip=True) or None

            # guard #2: link
            a = td.find("a")
            href = None
            if a and a.get("href"):
                href = urljoin(page_url, a["href"])

            # store a dict if there’s a link, else plain text
            row[header] = {"text": text, "href": href} if href else text

        data.append(row)

    return data

# ── Example usage ─────────────────────────────
if __name__ == "__main__":
    url = "https://cs128.org/2025b/syllabus-for-summer-2025-1416"
    # for the first site, you might have used "div.ita-table table"
    results = scrape_html_table(
        page_url      = url,
        table_selector= "div.ita-table table",
        table_index   = 0
    )
    for item in results:
        print(item)

    # for your new site, maybe the table has Bootstrap classes:
    bootstrap_data = scrape_html_table(
        page_url      = url,
        table_selector= "table.table-hover.table-sm",
        table_index   = 0
    )
    print(bootstrap_data)
