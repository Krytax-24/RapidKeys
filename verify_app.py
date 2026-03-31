import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to the local file
    page.goto("file:///app/index.html")
    page.wait_for_timeout(1000)

    # Type a few words to simulate the test
    # Get the words displayed

    # We can just type directly into the input
    input_box = page.locator("#textInput")

    # Let's type some random stuff since it's just visual verification that the app works
    for char in "hello world this is a test ":
        input_box.fill(input_box.input_value() + char)
        input_box.press("End")
        page.wait_for_timeout(100)

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()

        # Block external fonts to prevent navigation timeout in restricted network
        page.route("**/*.{woff,woff2,ttf,otf,eot}", lambda route: route.abort())
        page.route("https://fonts.googleapis.com/**", lambda route: route.abort())
        page.route("https://fonts.gstatic.com/**", lambda route: route.abort())

        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
