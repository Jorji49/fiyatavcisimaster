import 'package:flutter/material.dart';

class ProductCard extends StatelessWidget {
  final String name;
  final double price;
  final String store;
  final double score;
  final String forecast;
  final bool isOfficial;

  ProductCard({
    required this.name,
    required this.price,
    required this.store,
    this.score = 0.0,
    this.forecast = "",
    this.isOfficial = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isOfficial) {
      return Container(
        padding: EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [Colors.blue.shade900, Colors.black]),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            Icon(Icons.verified, color: Colors.blue, size: 40),
            SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                Text('RESMİ MAĞAZA', style: TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            )
          ],
        ),
      );
    }

    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(8)),
                child: Text('Skor: ${(score * 100).toInt()}', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              if (forecast.isNotEmpty)
                Text(forecast, style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          ),
          SizedBox(height: 12),
          Text(name, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          Text(store, style: TextStyle(color: Colors.grey, fontSize: 12)),
          Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('₺${price.toStringAsFixed(2)}', style: TextStyle(fontWeight: FontWeight.black, fontSize: 18)),
              Icon(Icons.arrow_forward_ios, size: 14, color: Colors.blue),
            ],
          )
        ],
      ),
    );
  }
}
