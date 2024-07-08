const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const bodyParser = require('body-parser');
const Transaction = require('./models/Transaction');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

mongoose.connect('mongodb://127.0.0.1:27017/transactions');

app.get('/seed', async (req, res) => {
  const apiUrl = 'https://s3.amazonaws.com/roxiler.com/product_transaction.json';

  try {
    const response = await axios.get(apiUrl);
    const data = response.data;

    await Transaction.deleteMany({});

    for (const item of data) {
      const newItem = new Transaction({
        title: item.title,
        description: item.description,
        price: item.price,
        dateOfSale: new Date(item.dateOfSale),
        category: item.category,
        sold: item.sold,
      });
      await newItem.save();
    }

    res.json({ message: 'Database seeded successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listing transactions with search and pagination:

app.get('/transactions', async (req, res) => {
  const { page = 1, perPage = 10, search = '', month } = req.query;

  const query = {
    dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) },
  };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { price: { $regex: search, $options: 'i' } },
    ];
  }

  const transactions = await Transaction.find(query)
    .skip((page - 1) * perPage)
    .limit(parseInt(perPage));

  res.json(transactions);
});

// API for statistics:

app.get('/statistics', async (req, res) => {
  const { month } = req.query;

  const query = {
    dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) },
  };

  const totalSaleAmount = await Transaction.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const totalSoldItems = await Transaction.countDocuments({ ...query, sold: true });
  const totalNotSoldItems = await Transaction.countDocuments({ ...query, sold: false });

  res.json({
    totalSaleAmount: totalSaleAmount[0]?.total || 0,
    totalSoldItems,
    totalNotSoldItems,
  });
});

// API for bar chart data:

app.get('/barchart', async (req, res) => {
  const { month } = req.query;

  const query = {
    dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) },
  };

  const priceRanges = [
    { range: '0-100', min: 0, max: 100 },
    { range: '101-200', min: 101, max: 200 },
    { range: '201-300', min: 201, max: 300 },
    { range: '301-400', min: 301, max: 400 },
    { range: '401-500', min: 401, max: 500 },
    { range: '501-600', min: 501, max: 600 },
    { range: '601-700', min: 601, max: 700 },
    { range: '701-800', min: 701, max: 800 },
    { range: '801-900', min: 801, max: 900 },
    { range: '901-above', min: 901, max: Infinity },
  ];

  const result = [];

  for (const range of priceRanges) {
    const count = await Transaction.countDocuments({
      ...query,
      price: { $gte: range.min, $lt: range.max === Infinity ? Number.MAX_VALUE : range.max },
    });
    result.push({ range: range.range, count });
  }

  res.json(result);
});

// API for pie chart data:

app.get('/piechart', async (req, res) => {
  const { month } = req.query;

  const query = {
    dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) },
  };

  const categories = await Transaction.aggregate([
    { $match: query },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  res.json(categories);
});

// API to combine all data:

app.get('/alldata', async (req, res) => {
  const { month } = req.query;

  const transactions = await Transaction.find({
    dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) },
  });

  const totalSaleAmount = await Transaction.aggregate([
    { $match: { dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) } } },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const totalSoldItems = await Transaction.countDocuments({ dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}-31T23:59:59.999Z`) }, sold: true });
  const totalNotSoldItems = await Transaction.countDocuments({ dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}-31T23:59:59.999Z`) }, sold: false });

  const priceRanges = [
    { range: '0-100', min: 0, max: 100 },
    { range: '101-200', min: 101, max: 200 },
    { range: '201-300', min: 201, max: 300 },
    { range: '301-400', min: 301, max: 400 },
    { range: '401-500', min: 401, max: 500 },
    { range: '501-600', min: 501, max: 600 },
    { range: '601-700', min: 601, max: 700 },
    { range: '701-800', min: 701, max: 800 },
    { range: '801-900', min: 801, max: 900 },
    { range: '901-above', min: 901, max: Infinity },
  ];

  const barChartResult = [];
  for (const range of priceRanges) {
    const count = await Transaction.countDocuments({
      dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) },
      price: { $gte: range.min, $lt: range.max === Infinity ? Number.MAX_VALUE : range.max },
    });
    barChartResult.push({ range: range.range, count });
  }

  const categories = await Transaction.aggregate([
    { $match: { dateOfSale: { $gte: new Date(`${month}`), $lt: new Date(`${month}`) } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  res.json({
    transactions,
    statistics: {
      totalSaleAmount: totalSaleAmount[0]?.total || 0,
      totalSoldItems,
      totalNotSoldItems,
    },
    barChart: barChartResult,
    pieChart: categories,
  });
});




app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
