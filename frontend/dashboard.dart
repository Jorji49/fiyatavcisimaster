import 'package:flutter/material.dart';

class ShoppingDashboard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Fiyat Avcısı: Alışveriş Paneli'),
        backgroundColor: Colors.blueAccent,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildSavingsCard(),
            _buildAutopilotEntry(context),
            _buildPersonalOffers(),
            _buildPriceAlerts(),
          ],
        ),
      ),
    );
  }

  Widget _buildSavingsCard() {
    return Container(
      margin: EdgeInsets.all(16),
      padding: EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.blue.shade700, Colors.blue.shade900]),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 20, offset: Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TOPLAM TASARRUF', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2)),
          SizedBox(height: 8),
          Text('₺1,420.50', style: TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.black)),
          SizedBox(height: 16),
          Row(
            children: [
              Icon(Icons.trending_up, color: Colors.greenAccent, size: 16),
              SizedBox(width: 4),
              Text('%12 Artış (Geçen aya göre)', style: TextStyle(color: Colors.white60, fontSize: 12)),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildPersonalOffers() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Senin İçin Fırsatlar', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
        Container(
          height: 150,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _offerItem('iPhone 16 Pro', '%15 İndirim'),
              _offerItem('Sony WH-1000XM5', 'Dip Fiyat!'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _offerItem(String name, String badge) {
    return Container(
      width: 140,
      margin: EdgeInsets.all(8),
      color: Colors.blue.shade50,
      child: Center(child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(name, textAlign: TextAlign.center),
          Chip(label: Text(badge, style: TextStyle(fontSize: 10))),
        ],
      )),
    );
  }

  Widget _buildAutopilotEntry(BuildContext context) {
    return Card(
      margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Colors.blue.shade800,
      child: ListTile(
        leading: Icon(Icons.auto_awesome, color: Colors.white),
        title: Text('Otopilot Asistanı', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        subtitle: Text('Bütçeni AI ile optimize et', style: TextStyle(color: Colors.white70)),
        trailing: Icon(Icons.chevron_right, color: Colors.white),
        onTap: () {
          // Navigate to AutopilotView
        },
      ),
    );
  }

  Widget _buildPriceAlerts() {
    return ListTile(
      title: Text('Aktif Takipteki Ürünler'),
      trailing: Badge(label: Text('3')),
    );
  }
}
