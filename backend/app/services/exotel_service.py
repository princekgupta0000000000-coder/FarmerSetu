import os
import urllib.error
import urllib.parse
import urllib.request


def send_sms(phone: str, message: str) -> dict:
    """Send an SMS through Exotel. Credentials are read only from environment variables."""
    sid = os.getenv("EXOTEL_ACCOUNT_SID")
    api_key = os.getenv("EXOTEL_API_KEY")
    api_token = os.getenv("EXOTEL_API_TOKEN")
    subdomain = os.getenv("EXOTEL_SUBDOMAIN", "api.exotel.com")
    sender = os.getenv("EXOTEL_FROM")

    if not all((sid, api_key, api_token, sender)):
        return {
            "sent": False,
            "configured": False,
            "message": "Exotel SMS is not configured yet.",
        }

    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if len(digits) == 10:
        digits = "91" + digits
    elif digits.startswith("91") and len(digits) == 12:
        pass
    else:
        return {"sent": False, "configured": True, "message": "Invalid Indian mobile number."}

    payload = urllib.parse.urlencode(
        {"from": sender, "to": digits, "body": message}
    ).encode()
    url = f"https://{subdomain}/v1/accounts/{urllib.parse.quote(sid, safe='')}/sms/send"
    request = urllib.request.Request(url, data=payload, method="POST")
    basic = (f"{api_key}:{api_token}").encode()
    import base64
    request.add_header("Authorization", "Basic " + base64.b64encode(basic).decode())
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    request.add_header("Accept", "application/json")

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode(errors="replace")
            return {"sent": True, "configured": True, "status_code": response.status, "response": raw[:2000]}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        return {
            "sent": False,
            "configured": True,
            "status_code": exc.code,
            "message": f"Exotel rejected the SMS request: {detail[:1000]}",
        }
    except Exception as exc:
        return {
            "sent": False,
            "configured": True,
            "message": f"Exotel SMS delivery failed: {str(exc)[:300]}",
        }
