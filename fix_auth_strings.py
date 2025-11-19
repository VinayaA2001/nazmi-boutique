from pathlib import Path

p = Path("Backend/app.py")
text = p.read_text(encoding="utf-8")

text = text.replace('"expires_at": {"": datetime.utcnow()}', '"expires_at": {"$gt": datetime.utcnow()}')
text = text.replace('{"": {"is_verified": True, "updated_at": datetime.utcnow()}}', '{"$set": {"is_verified": True, "updated_at": datetime.utcnow()}}')
text = text.replace('verify_url = f"{app.config["FRONTEND_URL"]}/verify-email?token={verify_token}"', 'verify_url = f"{app.config[\'FRONTEND_URL\']}/verify-email?token={verify_token}"')

p.write_text(text, encoding="utf-8")
