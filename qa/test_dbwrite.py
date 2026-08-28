import json, urllib.request, urllib.error

URL = "https://wcnssyiqitugqfmcbdhe.functions.supabase.co/db-write"
ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbnNzeWlxaXR1Z3FmbWNiZGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDEyNzUsImV4cCI6MjA5ODk3NzI3NX0.9EfbEr7BQhZtbOwHJ3IrkOy16kcaxlmzuJuV0A2Z8Eg"

def call(body):
    req = urllib.request.Request(URL, data=json.dumps(body).encode(),
        headers={"Content-Type":"application/json","apikey":ANON,"Authorization":f"Bearer {ANON}"})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

print("=== 1) register ===")
st, r = call({"action":"register","qq":"13800009991","password_hash":"abc123hash","nickname":"验证员"})
print(st, r)
uid = r.get("profile",{}).get("id") if st==200 else None
if not uid:
    print("REGISTER FAILED"); raise SystemExit(1)
print("uid =", uid)

print("=== 2) recharge 100 ===")
st, r = call({"action":"recharge","uid":uid,"amount":100})
print(st, r)

print("=== 3) publish_task ===")
st, r = call({"action":"publish_task","uid":uid,"task":{
    "title":"帮我取快递","category":"跑腿","amount":20,"deadline":"2026-09-30T00:00:00+08:00",
    "description":"校门口","images":[],"poster_id":uid,"poster_name":"验证员","poster_avatar":""}})
print(st, r)
tid = r.get("task",{}).get("id") if st==200 else None

print("=== 4) publish_post ===")
st, r = call({"action":"publish_post","uid":uid,"post":{
    "title":"校园二手","content":"出书","images":[],"author_id":uid,"author_name":"验证员","author_avatar":"","status":"on"}})
print(st, r)

print("=== 5) publish_goods ===")
st, r = call({"action":"publish_goods","uid":uid,"goods":{
    "title":"旧自行车","price":150,"category":"出行","description":"九成新","images":[],"seller_id":uid,"seller_name":"验证员","status":"on"}})
print(st, r)

print("=== 6) send_message (generic insert) ===")
st, r = call({"action":"insert","uid":uid,"table":"messages","row":{
    "conv_id":"x_y","sender_id":uid,"receiver_id":uid,"content":"hi","type":"text"}})
print(st, r)

print("=== 7) 越权测试：用别的 uid 改他人 task 应被拒 (update not used here; test insert owner mismatch) ===")
st, r = call({"action":"insert","uid":"00000000-0000-0000-0000-000000000000","table":"messages","row":{
    "conv_id":"x_y","sender_id":uid,"receiver_id":uid,"content":"hack","type":"text"}})
print(st, r, "(预期 403)")

print("\nUID for cleanup:", uid)
