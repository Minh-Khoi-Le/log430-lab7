// MongoDB initialization script for Event Store
// This script creates the necessary database and collections for the event store

print('Starting MongoDB initialization for Event Store...');

// Switch to the eventstore database
db = db.getSiblingDB('eventstore');

// Create collections if they don't exist
db.createCollection('events');
db.createCollection('snapshots');
db.createCollection('aggregates');

// Create indexes for better performance
db.events.createIndex({ "aggregateId": 1, "version": 1 }, { unique: true });
db.events.createIndex({ "aggregateType": 1 });
db.events.createIndex({ "eventType": 1 });
db.events.createIndex({ "timestamp": 1 });
db.events.createIndex({ "correlationId": 1 });

db.snapshots.createIndex({ "aggregateId": 1, "version": 1 }, { unique: true });
db.snapshots.createIndex({ "aggregateType": 1 });
db.snapshots.createIndex({ "timestamp": 1 });

db.aggregates.createIndex({ "aggregateId": 1 }, { unique: true });
db.aggregates.createIndex({ "aggregateType": 1 });
db.aggregates.createIndex({ "lastModified": 1 });

print('MongoDB initialization completed successfully!');
print('Created collections: events, snapshots, aggregates');
print('Created performance indexes');
