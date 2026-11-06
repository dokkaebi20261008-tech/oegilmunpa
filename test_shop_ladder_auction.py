import urllib.request
import urllib.error
import http.cookiejar
import json

BASE_URL = "http://localhost:3000"

def run_test():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    def request_json(path, method="GET", payload=None):
        url = BASE_URL + path
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Content-Type": "application/json"} if payload is not None else {}
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with opener.open(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode("utf-8"))

    print("=== [1] Logging in as Admin (문파장) ===")
    status, login_res = request_json("/api/auth/login", "POST", {"username": "admin", "password": "admin1234"})
    assert status == 200 and login_res.get("success"), f"Login failed: {login_res}"
    print("Logged in successfully:", login_res["user"]["nickname"])

    print("\n=== [2] Verifying 3 Official Guild Shop Items ===")
    status, shop_res = request_json("/api/shop", "GET")
    assert status == 200 and shop_res.get("success"), f"Shop GET failed: {shop_res}"
    items = shop_res["items"]
    assert len(items) == 3, f"Expected 3 items, got {len(items)}"
    expected_names = [
        "전설 무기 도안 선택 상자",
        "산군의 위엄 방어구 도안 선택 상자",
        "산군의 어금니 장신구 도안 선택 상자"
    ]
    for idx, exp_name in enumerate(expected_names):
        assert items[idx]["name"] == exp_name, f"Mismatch: {items[idx]['name']} != {exp_name}"
        assert items[idx]["price"] == 11500, f"Price mismatch: {items[idx]['price']}"
        print(f"Verified Shop Item {idx+1}: {items[idx]['name']} ({items[idx]['price']:,} 주화, 희망자: {items[idx].get('applicants')})")

    print("\n=== [3] Testing Applicant Registration per Item ===")
    status, add_res = request_json("/api/shop", "POST", {
        "action": "ADD_APPLICANT",
        "itemId": "shop_1",
        "nickname": "빠따왕"
    })
    assert status == 200 and "빠따왕" in add_res["item"]["applicants"]
    print("Added applicant '빠따왕' to 전설 무기 도안 선택 상자:", add_res["item"]["applicants"])

    status, rem_res = request_json("/api/shop", "POST", {
        "action": "REMOVE_APPLICANT",
        "itemId": "shop_1",
        "nickname": "빠따왕"
    })
    assert status == 200 and "빠따왕" not in rem_res["item"]["applicants"]
    print("Removed temporary applicant '빠따왕' cleanly.")

    print("\n=== [4] Testing Interactive Ladder Game (RUN_LADDER) ===")
    status, ladder_res = request_json("/api/shop", "POST", {
        "action": "RUN_LADDER",
        "onlyWithApplicants": True,
        "startCol": 0
    })
    assert status == 200 and ladder_res.get("success"), f"Ladder failed: {ladder_res}"
    lstate = ladder_res["ladderState"]
    print(f"Ladder Executed! Columns: {lstate['numCols']}, Rungs: {len(lstate['rungs'])}, Path steps: {len(lstate['path'])}")
    print(f"Start Col: {lstate['chosenStartCol'] + 1}번 -> Winning Col: {lstate['winningBottomCol'] + 1}번 -> Winner Item: [{lstate['winnerItem']['name']}]")

    print("\n=== [5] Testing Auction Creation from Ladder Winner (Start: 20,000 / Increment: 500) ===")
    winner_item_id = lstate["winnerItem"]["itemId"]
    status, auc_create = request_json("/api/shop", "POST", {
        "action": "START_AUCTION_FROM_SHOP",
        "itemId": winner_item_id,
        "startingBid": 20000,
        "minBidIncrement": 500,
        "durationHours": 24
    })
    assert status == 200 and auc_create.get("success"), f"Auction create failed: {auc_create}"
    new_auc = auc_create["auction"]
    auc_id = new_auc["id"]
    print(f"Created Auction [{new_auc['title']}] (ID: {auc_id}) - Start: {new_auc['startingBid']:,} / Increment: +{new_auc['minBidIncrement']:,}")

    print("\n=== [6] Testing Bidding Rule: 20,000 Start -> Next 20,500 (+500 Increment) ===")
    # 1st bid at 20,000
    status, bid1 = request_json(f"/api/auction/{auc_id}/bid", "POST", {"amount": 20000})
    assert status == 200 and bid1.get("success"), f"1st bid at 20,000 failed: {bid1}"
    print("1st Bid at 20,000 Gold succeeded!")

    # Invalid 2nd bid at 20,300 (< 20,500)
    status, bid_invalid = request_json(f"/api/auction/{auc_id}/bid", "POST", {"amount": 20300})
    assert status == 400 and not bid_invalid.get("success"), "Invalid bid 20,300 should have been rejected!"
    print("Invalid 2nd Bid at 20,300 Gold properly rejected:", bid_invalid.get("message"))

    # Valid 2nd bid at 20,500 (20,000 + 500)
    status, bid2 = request_json(f"/api/auction/{auc_id}/bid", "POST", {"amount": 20500})
    assert status == 200 and bid2.get("success"), f"2nd bid at 20,500 failed: {bid2}"
    print("2nd Bid at 20,500 Gold (+500 unit) succeeded! Current Bid:", bid2["auction"]["currentBid"])

    print("\n>>> ALL SHOP, LADDER, AND AUCTION INCREMENT TESTS PASSED 100%! <<<")

if __name__ == "__main__":
    run_test()
