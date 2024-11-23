# Crypto Price Predictor

Ứng dụng dự đoán giá tiền mã hóa sử dụng dữ liệu từ Binance API.

## Các Chỉ Số Hiển Thị

### Biểu Đồ

1. **Price Analysis**

   - Đường giá lịch sử (màu xanh lá)
   - Đường dự đoán (màu cam, nét đứt)

2. **Technical Indicators**
   - RSI (Relative Strength Index): Chỉ báo về xu hướng quá mua/quá bán (0-100)
   - Momentum: Động lượng giá (-100 đến 100)
   - Trend: Xu hướng thị trường (-100 đến 100)

### Market Analysis

1. **Current Price**: Giá hiện tại của coin
2. **Predicted Price**: Giá dự đoán trong tương lai gần
3. **Market Pattern**: Mô hình thị trường hiện tại
   - ACCUMULATION: Giai đoạn tích lũy
   - BREAKOUT_UP: Đột phá tăng giá
   - BREAKOUT_DOWN: Đột phá giảm giá
   - CONSOLIDATION: Giai đoạn tích lũy ngang
4. **Trend**: Xu hướng thị trường
   - STRONG_BULLISH: Xu hướng tăng mạnh
   - BULLISH: Xu hướng tăng
   - BEARISH: Xu hướng giảm
   - STRONG_BEARISH: Xu hướng giảm mạnh
   - NEUTRAL: Trung tính

### Technical Analysis

1. **RSI**: Chỉ báo sức mạnh tương đối
   - > 70: Quá mua
   - < 30: Quá bán
2. **Momentum**: Động lượng của xu hướng giá
3. **Volatility**: Độ biến động của thị trường
4. **Confidence**: Độ tin cậy của dự đoán

### Prediction Results

1. **Price Movement**: Phần trăm thay đổi giá dự kiến
2. **Confidence Score**: Độ tin cậy của dự đoán
3. **Time Frame**: Khung thời gian phân tích
4. **Risk Level**: Mức độ rủi ro
   - High: Rủi ro cao (>50% volatility)
   - Medium: Rủi ro trung bình (30-50% volatility)
   - Low: Rủi ro thấp (<30% volatility)
5. **Signal Strength**: Độ mạnh của tín hiệu giao dịch
6. **Volume Profile**: Mức độ tham gia của thị trường
7. **Market Sentiment**: Tâm lý thị trường tổng thể
8. **Pattern Recognition**: Nhận diện mô hình giá

## Sử Dụng

1. Nhập mã coin (ví dụ: BTCUSDT, ETHUSDT)
2. Chọn khung thời gian phân tích
3. Nhấn "Predict" để xem kết quả dự đoán

## Lưu Ý

- Dự đoán chỉ mang tính tham khảo
- Độ tin cậy phụ thuộc vào nhiều yếu tố thị trường
- Nên kết hợp với các phương pháp phân tích khác
- Giới hạn 30 request/phút để tránh quá tải
