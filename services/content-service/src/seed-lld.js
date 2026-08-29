import { pool } from './db.js';

async function ensureLldProject({title,description,difficulty,estimatedMinutes,tags,classes}){
  const existing=await pool.query('SELECT id FROM projects WHERE title=$1 LIMIT 1',[title]);
  if(existing.rowCount)return;

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const project=await client.query(
      `INSERT INTO projects(title,description,category,difficulty,estimated_minutes,tags)
       VALUES($1,$2,'lld',$3,$4,$5) RETURNING id`,
      [title,description,difficulty,estimatedMinutes,tags]
    );
    for(const item of classes){
      await client.query(
        `INSERT INTO lld_classes(project_id,name,reference_code,pattern_tag,order_index)
         VALUES($1,$2,$3,$4,$5)`,
        [project.rows[0].id,item.name,item.code,item.pattern,item.order]
      );
    }
    await client.query('COMMIT');
    console.log('Seeded LLD',title);
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
}

await ensureLldProject({
  title:'Parking Lot System',
  description:'Design a multi-floor parking lot with vehicle-specific spots, tickets, and a swappable spot-assignment policy.',
  difficulty:'advanced',
  estimatedMinutes:60,
  tags:['cpp','strategy','factory'],
  classes:[
    {name:'Vehicle',pattern:'Factory',order:1,code:`enum class VehicleType { Motorcycle, Car, Truck };

class Vehicle {
protected:
    string license;
    VehicleType type;
public:
    Vehicle(string license, VehicleType type)
        : license(move(license)), type(type) {}
    virtual ~Vehicle() = default;
    VehicleType getType() const { return type; }
};`},
    {name:'ParkingSpot',pattern:'Factory',order:2,code:`class ParkingSpot {
protected:
    string id;
    bool occupied = false;
public:
    explicit ParkingSpot(string id) : id(move(id)) {}
    virtual bool canFit(const Vehicle& vehicle) const = 0;
    bool park(const Vehicle& vehicle) {
        if (occupied || !canFit(vehicle)) return false;
        occupied = true;
        return true;
    }
    void leave() { occupied = false; }
    virtual ~ParkingSpot() = default;
};`},
    {name:'SpotAssignmentStrategy',pattern:'Strategy',order:3,code:`class SpotAssignmentStrategy {
public:
    virtual ParkingSpot* findSpot(
        vector<unique_ptr<ParkingSpot>>& spots,
        const Vehicle& vehicle
    ) = 0;
    virtual ~SpotAssignmentStrategy() = default;
};

class FirstFitStrategy : public SpotAssignmentStrategy {
public:
    ParkingSpot* findSpot(vector<unique_ptr<ParkingSpot>>& spots,
                          const Vehicle& vehicle) override {
        for (auto& spot : spots)
            if (spot->canFit(vehicle)) return spot.get();
        return nullptr;
    }
};`},
    {name:'ParkingLot',pattern:'Strategy',order:4,code:`class ParkingLot {
    vector<vector<unique_ptr<ParkingSpot>>> floors;
    unique_ptr<SpotAssignmentStrategy> strategy;
public:
    explicit ParkingLot(unique_ptr<SpotAssignmentStrategy> strategy)
        : strategy(move(strategy)) {}

    ParkingSpot* findSpot(const Vehicle& vehicle) {
        for (auto& floor : floors)
            if (auto* spot = strategy->findSpot(floor, vehicle))
                return spot;
        return nullptr;
    }
};`}
  ]
});

await ensureLldProject({
  title:'LRU Cache',
  description:'Implement O(1) get and put using a hash map plus a doubly linked list.',
  difficulty:'intermediate',
  estimatedMinutes:35,
  tags:['cpp','hashmap','linked-list'],
  classes:[
    {name:'Node',pattern:'none',order:1,code:`class Node {
public:
    int key;
    int value;
    Node* prev = nullptr;
    Node* next = nullptr;

    Node(int key, int value) : key(key), value(value) {}
};`},
    {name:'LRUCache',pattern:'none',order:2,code:`class LRUCache {
    int capacity;
    unordered_map<int, Node*> cache;
    Node head{0, 0}, tail{0, 0};

    void remove(Node* node) {
        node->prev->next = node->next;
        node->next->prev = node->prev;
    }

    void addFront(Node* node) {
        node->next = head.next;
        node->prev = &head;
        head.next->prev = node;
        head.next = node;
    }

public:
    explicit LRUCache(int capacity) : capacity(capacity) {
        head.next = &tail;
        tail.prev = &head;
    }

    int get(int key) {
        if (!cache.count(key)) return -1;
        Node* node = cache[key];
        remove(node);
        addFront(node);
        return node->value;
    }
};`}
  ]
});

await ensureLldProject({
  title:'Rate Limiter',
  description:'Implement token-bucket and sliding-window algorithms behind one interchangeable rate-limiter interface.',
  difficulty:'intermediate',
  estimatedMinutes:45,
  tags:['cpp','strategy','rate-limiter'],
  classes:[
    {name:'RateLimiterStrategy',pattern:'Strategy',order:1,code:`class RateLimiterStrategy {
public:
    virtual bool allow(const string& key) = 0;
    virtual ~RateLimiterStrategy() = default;
};`},
    {name:'TokenBucketLimiter',pattern:'Strategy',order:2,code:`class TokenBucketLimiter : public RateLimiterStrategy {
    struct Bucket {
        double tokens;
        chrono::steady_clock::time_point last;
    };

    double capacity;
    double refillRate;
    unordered_map<string, Bucket> buckets;

public:
    TokenBucketLimiter(double capacity, double refillRate)
        : capacity(capacity), refillRate(refillRate) {}

    bool allow(const string& key) override {
        auto now = chrono::steady_clock::now();
        auto [it, inserted] = buckets.try_emplace(key, Bucket{capacity, now});
        auto& bucket = it->second;
        double elapsed = chrono::duration<double>(now - bucket.last).count();
        bucket.tokens = min(capacity, bucket.tokens + elapsed * refillRate);
        bucket.last = now;
        if (bucket.tokens < 1.0) return false;
        bucket.tokens -= 1.0;
        return true;
    }
};`},
    {name:'SlidingWindowLimiter',pattern:'Strategy',order:3,code:`class SlidingWindowLimiter : public RateLimiterStrategy {
    size_t limit;
    chrono::seconds window;
    unordered_map<string, deque<chrono::steady_clock::time_point>> requests;

public:
    SlidingWindowLimiter(size_t limit, int seconds)
        : limit(limit), window(seconds) {}

    bool allow(const string& key) override {
        auto now = chrono::steady_clock::now();
        auto& queue = requests[key];
        while (!queue.empty() && now - queue.front() >= window)
            queue.pop_front();
        if (queue.size() >= limit) return false;
        queue.push_back(now);
        return true;
    }
};`}
  ]
});

await ensureLldProject({
  title:'Elevator System',
  description:'Design multiple elevators with request scheduling, direction/state handling, and a replaceable dispatch strategy.',
  difficulty:'advanced',
  estimatedMinutes:60,
  tags:['cpp','strategy','state'],
  classes:[
    {name:'Elevator',pattern:'State',order:1,code:`enum class Direction { Up, Down, Idle };

class Elevator {
    int id;
    int floor = 0;
    Direction direction = Direction::Idle;
    set<int> stops;
public:
    explicit Elevator(int id) : id(id) {}
    int currentFloor() const { return floor; }
    Direction currentDirection() const { return direction; }
    void addStop(int target) { stops.insert(target); }
    bool hasWork() const { return !stops.empty(); }
};`},
    {name:'DispatchStrategy',pattern:'Strategy',order:2,code:`class DispatchStrategy {
public:
    virtual Elevator* select(
        vector<unique_ptr<Elevator>>& elevators,
        int requestedFloor
    ) = 0;
    virtual ~DispatchStrategy() = default;
};

class NearestCarStrategy : public DispatchStrategy {
public:
    Elevator* select(vector<unique_ptr<Elevator>>& elevators,
                     int requestedFloor) override {
        return min_element(elevators.begin(), elevators.end(),
            [requestedFloor](const auto& a, const auto& b) {
                return abs(a->currentFloor() - requestedFloor) <
                       abs(b->currentFloor() - requestedFloor);
            })->get();
    }
};`},
    {name:'ElevatorController',pattern:'Strategy',order:3,code:`class ElevatorController {
    vector<unique_ptr<Elevator>> elevators;
    unique_ptr<DispatchStrategy> strategy;
public:
    explicit ElevatorController(unique_ptr<DispatchStrategy> strategy)
        : strategy(move(strategy)) {}

    void request(int floor) {
        Elevator* elevator = strategy->select(elevators, floor);
        if (elevator) elevator->addStop(floor);
    }
};`}
  ]
});

await pool.end();
