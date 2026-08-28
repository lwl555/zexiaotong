#!/usr/bin/env bash
# 数据通信链路前后对比测量
# 用法: bash qa/datalink.sh <label>   (label 如 before / after)
set -u
LABEL="${1:-before}"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbnNzeWlxaXR1Z3FmbWNiZGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDEyNzUsImV4cCI6MjA5ODk3NzI3NX0.9EfbEr7BQhZtbOwHJ3IrkOy16kcaxlmzuJuV0A2Z8Eg"
SB="https://wcnssyiqitugqfmcbdhe.supabase.co"
AGNES="https://wcnssyiqitugqfmcbdhe.functions.supabase.co/agnes-search"
OUT="qa/datalink-${LABEL}.txt"
N=5

echo "=== 数据链路测量 @ $LABEL ===" | tee "$OUT"
echo "时间: $(date)" | tee -a "$OUT"

# 1) Supabase REST anon select profiles
echo "" | tee -a "$OUT"
echo "[1] REST /profiles (anon select) x$N" | tee -a "$OUT"
for i in $(seq 1 $N); do
  code=$(curl -s -m 20 -o /tmp/p.json -w "%{http_code}" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "$SB/rest/v1/profiles?select=id,qq,role&limit=3")
  t=$(curl -s -m 20 -o /dev/null -w "%{time_total}" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" "$SB/rest/v1/profiles?select=id,qq,role&limit=3")
  echo "  try$i: http=$code time=${t}s" | tee -a "$OUT"
done

# 2) agnes-search 边缘函数（聊天，非流式）
echo "" | tee -a "$OUT"
echo "[2] Edge agnes-search /v1/chat/completions (non-stream) x$N" | tee -a "$OUT"
for i in $(seq 1 $N); do
  t=$(curl -s -m 90 -o /tmp/a.json -w "%{time_total}" -X POST "$AGNES/v1/chat/completions" \
    -H "Content-Type: application/json" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -d '{"model":"agnes-2.0-flash","messages":[{"role":"user","content":"用一句话介绍北京大学"}],"stream":false,"web_search":true}')
  # 提取是否有内容
  has=$(grep -c "choices" /tmp/a.json 2>/dev/null || echo 0)
  echo "  try$i: time=${t}s hasChoices=$has" | tee -a "$OUT"
done

# 3) agnes-search 首页预热(空/轻请求)
echo "" | tee -a "$OUT"
echo "[3] Edge agnes-search OPTIONS/轻探 x3" | tee -a "$OUT"
for i in $(seq 1 3); do
  t=$(curl -s -m 30 -o /dev/null -w "%{time_total}" -X POST "$AGNES/v1/chat/completions" \
    -H "Content-Type: application/json" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    -d '{"model":"agnes-2.0-flash","messages":[{"role":"user","content":"你好"}],"stream":false}')
  echo "  try$i: time=${t}s" | tee -a "$OUT"
done

echo "" | tee -a "$OUT"
echo "done -> $OUT" | tee -a "$OUT"
