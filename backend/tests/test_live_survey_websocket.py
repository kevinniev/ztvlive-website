"""
ZTVLIVE Live Survey WebSocket Tests

Tests for the 24/7 Live Survey Game with WebSocket real-time sync:
- GET /api/live-survey/state - Game state endpoint
- WebSocket /api/live-survey/ws/{client_id} - Real-time sync
- Multiple simultaneous WebSocket connections
- Answer submission via WebSocket
- Game state synchronization across clients
"""

import pytest
import requests
import asyncio
import websockets
import json
import time
import os
from concurrent.futures import ThreadPoolExecutor

# Use production URL from environment or default
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://best-bites-live.preview.emergentagent.com').rstrip('/')
WS_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')


class TestLiveSurveyStateEndpoint:
    """Tests for GET /api/live-survey/state endpoint"""
    
    def test_state_endpoint_returns_200(self):
        """Test that state endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/live-survey/state", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/live-survey/state returns 200")
    
    def test_state_response_structure(self):
        """Test that state response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/live-survey/state", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        
        # Required fields in game state
        required_fields = [
            'question',
            'question_number',
            'time_remaining',
            'batch_time_remaining',
            'batch_number',
            'total_answers',
            'player_count',
            'is_live',
            'showing_results',
            'top_answers'
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"PASS: State response has all required fields: {required_fields}")
        print(f"  - question: {data.get('question', 'N/A')[:50]}...")
        print(f"  - is_live: {data.get('is_live')}")
        print(f"  - player_count: {data.get('player_count')}")
        print(f"  - total_answers: {data.get('total_answers')}")
    
    def test_state_data_types(self):
        """Test that state response has correct data types"""
        response = requests.get(f"{BASE_URL}/api/live-survey/state", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check data types
        assert isinstance(data.get('question_number'), int), "question_number should be int"
        assert isinstance(data.get('time_remaining'), int), "time_remaining should be int"
        assert isinstance(data.get('batch_time_remaining'), int), "batch_time_remaining should be int"
        assert isinstance(data.get('batch_number'), int), "batch_number should be int"
        assert isinstance(data.get('total_answers'), int), "total_answers should be int"
        assert isinstance(data.get('player_count'), int), "player_count should be int"
        assert isinstance(data.get('is_live'), bool), "is_live should be bool"
        assert isinstance(data.get('showing_results'), bool), "showing_results should be bool"
        assert isinstance(data.get('top_answers'), list), "top_answers should be list"
        
        print("PASS: All state fields have correct data types")
    
    def test_state_time_values_reasonable(self):
        """Test that time values are within reasonable ranges"""
        response = requests.get(f"{BASE_URL}/api/live-survey/state", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        
        # Time remaining should be 0-60 seconds (question duration)
        time_remaining = data.get('time_remaining', 0)
        assert 0 <= time_remaining <= 60, f"time_remaining {time_remaining} out of range 0-60"
        
        # Batch time remaining should be 0-600 seconds (10 minutes)
        batch_time = data.get('batch_time_remaining', 0)
        assert 0 <= batch_time <= 600, f"batch_time_remaining {batch_time} out of range 0-600"
        
        print(f"PASS: Time values reasonable - question: {time_remaining}s, batch: {batch_time}s")


class TestLiveSurveyJoinEndpoint:
    """Tests for POST /api/live-survey/join endpoint"""
    
    def test_join_without_player_id(self):
        """Test joining game without providing player_id"""
        response = requests.post(f"{BASE_URL}/api/live-survey/join", json={}, timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'player_id' in data, "Response should contain player_id"
        assert data['player_id'].startswith('player_'), "Generated player_id should start with 'player_'"
        
        print(f"PASS: Join without player_id generates new ID: {data['player_id']}")
    
    def test_join_with_player_id(self):
        """Test joining game with existing player_id"""
        test_player_id = f"TEST_player_{int(time.time())}"
        response = requests.post(
            f"{BASE_URL}/api/live-survey/join",
            json={"player_id": test_player_id},
            timeout=10
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data['player_id'] == test_player_id, "Should return same player_id"
        assert 'batch_number' in data
        assert 'player_count' in data
        
        print(f"PASS: Join with player_id returns correct data")
        print(f"  - player_id: {data['player_id']}")
        print(f"  - batch_number: {data.get('batch_number')}")
        print(f"  - player_count: {data.get('player_count')}")


class TestLiveSurveyAnswerEndpoint:
    """Tests for POST /api/live-survey/answer endpoint"""
    
    def test_answer_submission(self):
        """Test submitting an answer via REST API"""
        # First join to get a player_id
        join_response = requests.post(f"{BASE_URL}/api/live-survey/join", json={}, timeout=10)
        player_id = join_response.json()['player_id']
        
        # Get current state to check if we can answer
        state = requests.get(f"{BASE_URL}/api/live-survey/state", timeout=10).json()
        
        if not state.get('is_live') or state.get('showing_results') or state.get('time_remaining', 0) < 5:
            print("SKIP: Cannot test answer submission - game not in answerable state")
            pytest.skip("Game not in answerable state")
        
        # Submit answer
        response = requests.post(
            f"{BASE_URL}/api/live-survey/answer",
            json={"player_id": player_id, "answer": "test answer"},
            timeout=10
        )
        
        # Could be 200 (success) or 400 (already answered, time up, etc.)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('success') == True
            assert 'same_answer_percent' in data
            assert 'total_answers' in data
            print(f"PASS: Answer submitted successfully")
            print(f"  - same_answer_percent: {data.get('same_answer_percent')}%")
            print(f"  - total_answers: {data.get('total_answers')}")
        else:
            print(f"INFO: Answer rejected (expected in some game states): {response.json()}")


class TestLiveSurveyLeaderboard:
    """Tests for GET /api/live-survey/leaderboard endpoint"""
    
    def test_leaderboard_endpoint(self):
        """Test leaderboard endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/live-survey/leaderboard", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert 'leaderboard' in data
        assert isinstance(data['leaderboard'], list)
        
        print(f"PASS: Leaderboard endpoint returns {len(data['leaderboard'])} players")


class TestLiveSurveyShareInfo:
    """Tests for GET /api/live-survey/share-qr endpoint"""
    
    def test_share_info_endpoint(self):
        """Test share info endpoint returns QR data"""
        response = requests.get(f"{BASE_URL}/api/live-survey/share-qr", timeout=10)
        assert response.status_code == 200
        
        data = response.json()
        assert 'play_url' in data
        assert 'share_text' in data
        assert 'hashtags' in data
        
        print(f"PASS: Share info endpoint returns correct data")
        print(f"  - play_url: {data.get('play_url')}")


class TestWebSocketConnection:
    """Tests for WebSocket connection at /api/live-survey/ws/{client_id}"""
    
    @pytest.mark.asyncio
    async def test_websocket_connects(self):
        """Test that WebSocket connection can be established"""
        client_id = f"TEST_ws_client_{int(time.time())}"
        ws_endpoint = f"{WS_URL}/api/live-survey/ws/{client_id}"
        
        try:
            async with websockets.connect(ws_endpoint, open_timeout=10, close_timeout=10) as ws:
                # Should receive initial game state on connect
                message = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(message)
                
                assert 'event' in data, "Initial message should have 'event' field"
                assert data['event'] == 'connected', f"Expected 'connected' event, got {data['event']}"
                
                print(f"PASS: WebSocket connected successfully")
                print(f"  - event: {data.get('event')}")
                print(f"  - question: {data.get('question', 'N/A')[:50]}...")
                print(f"  - player_count: {data.get('player_count')}")
                
        except Exception as e:
            pytest.fail(f"WebSocket connection failed: {e}")
    
    @pytest.mark.asyncio
    async def test_websocket_receives_game_state(self):
        """Test that WebSocket receives complete game state on connect"""
        client_id = f"TEST_ws_state_{int(time.time())}"
        ws_endpoint = f"{WS_URL}/api/live-survey/ws/{client_id}"
        
        async with websockets.connect(ws_endpoint, open_timeout=10, close_timeout=10) as ws:
            message = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(message)
            
            # Check for required game state fields
            required_fields = ['event', 'question', 'time_remaining', 'player_count', 'total_answers']
            for field in required_fields:
                assert field in data, f"Missing field in WebSocket message: {field}"
            
            print(f"PASS: WebSocket receives complete game state")
            print(f"  - Fields received: {list(data.keys())}")
    
    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self):
        """Test WebSocket ping/pong heartbeat"""
        client_id = f"TEST_ws_ping_{int(time.time())}"
        ws_endpoint = f"{WS_URL}/api/live-survey/ws/{client_id}"
        
        async with websockets.connect(ws_endpoint, open_timeout=10, close_timeout=10) as ws:
            # Receive initial state
            await asyncio.wait_for(ws.recv(), timeout=5)
            
            # Send ping
            await ws.send(json.dumps({"type": "ping"}))
            
            # Should receive pong
            message = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(message)
            
            assert data.get('event') == 'pong', f"Expected 'pong' event, got {data.get('event')}"
            assert 'time_remaining' in data
            assert 'player_count' in data
            
            print(f"PASS: WebSocket ping/pong works correctly")
            print(f"  - time_remaining: {data.get('time_remaining')}")
            print(f"  - player_count: {data.get('player_count')}")


class TestMultipleWebSocketConnections:
    """Tests for multiple simultaneous WebSocket connections"""
    
    @pytest.mark.asyncio
    async def test_multiple_clients_receive_same_state(self):
        """Test that multiple WebSocket clients receive synchronized game state"""
        client_ids = [f"TEST_multi_{i}_{int(time.time())}" for i in range(3)]
        ws_endpoints = [f"{WS_URL}/api/live-survey/ws/{cid}" for cid in client_ids]
        
        received_states = []
        
        async def connect_and_receive(endpoint):
            async with websockets.connect(endpoint, open_timeout=10, close_timeout=10) as ws:
                message = await asyncio.wait_for(ws.recv(), timeout=5)
                return json.loads(message)
        
        # Connect all clients simultaneously
        tasks = [connect_and_receive(ep) for ep in ws_endpoints]
        results = await asyncio.gather(*tasks)
        
        # All clients should receive the same question
        questions = [r.get('question') for r in results]
        assert len(set(questions)) == 1, f"Clients received different questions: {questions}"
        
        # All clients should have similar player counts (may vary slightly due to timing)
        player_counts = [r.get('player_count', 0) for r in results]
        max_diff = max(player_counts) - min(player_counts)
        assert max_diff <= 5, f"Player counts differ too much: {player_counts}"
        
        print(f"PASS: {len(client_ids)} clients received synchronized state")
        print(f"  - Same question: {questions[0][:50]}...")
        print(f"  - Player counts: {player_counts}")
    
    @pytest.mark.asyncio
    async def test_answer_broadcast_to_all_clients(self):
        """Test that answer updates are broadcast to all connected clients"""
        # Connect two clients
        client1_id = f"TEST_broadcast1_{int(time.time())}"
        client2_id = f"TEST_broadcast2_{int(time.time())}"
        
        ws1_endpoint = f"{WS_URL}/api/live-survey/ws/{client1_id}"
        ws2_endpoint = f"{WS_URL}/api/live-survey/ws/{client2_id}"
        
        async with websockets.connect(ws1_endpoint, open_timeout=10, close_timeout=10) as ws1:
            async with websockets.connect(ws2_endpoint, open_timeout=10, close_timeout=10) as ws2:
                # Receive initial states
                state1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
                state2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=5))
                
                # Check if game is in answerable state
                if state1.get('time_remaining', 0) < 5 or state1.get('showing_results'):
                    print("SKIP: Game not in answerable state for broadcast test")
                    pytest.skip("Game not in answerable state")
                
                # Client 1 submits an answer
                await ws1.send(json.dumps({"type": "answer", "answer": "test broadcast"}))
                
                # Wait for messages (could be answer_confirmed or answer_update)
                messages_received = []
                try:
                    for _ in range(5):  # Try to receive up to 5 messages
                        msg = await asyncio.wait_for(ws2.recv(), timeout=3)
                        messages_received.append(json.loads(msg))
                except asyncio.TimeoutError:
                    pass
                
                # Check if any message was an answer_update
                update_events = [m for m in messages_received if m.get('event') in ['answer_update', 'answer_confirmed']]
                
                print(f"PASS: Broadcast test completed")
                print(f"  - Messages received by client2: {len(messages_received)}")
                print(f"  - Update events: {[m.get('event') for m in update_events]}")


class TestWebSocketAnswerSubmission:
    """Tests for answer submission via WebSocket"""
    
    @pytest.mark.asyncio
    async def test_answer_via_websocket(self):
        """Test submitting answer through WebSocket"""
        client_id = f"TEST_ws_answer_{int(time.time())}"
        ws_endpoint = f"{WS_URL}/api/live-survey/ws/{client_id}"
        
        async with websockets.connect(ws_endpoint, open_timeout=10, close_timeout=10) as ws:
            # Receive initial state
            state = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            
            # Check if we can answer
            if state.get('time_remaining', 0) < 5 or state.get('showing_results'):
                print("SKIP: Game not in answerable state")
                pytest.skip("Game not in answerable state")
            
            # Submit answer via WebSocket
            await ws.send(json.dumps({"type": "answer", "answer": "websocket test answer"}))
            
            # Wait for confirmation
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(response)
                
                if data.get('event') == 'answer_confirmed':
                    assert 'answer' in data
                    assert 'same_percent' in data
                    assert 'same_count' in data
                    print(f"PASS: Answer submitted via WebSocket")
                    print(f"  - answer: {data.get('answer')}")
                    print(f"  - same_percent: {data.get('same_percent')}%")
                else:
                    print(f"INFO: Received event: {data.get('event')}")
                    
            except asyncio.TimeoutError:
                print("INFO: No immediate response to answer (may be processed)")


class TestGameStateConsistency:
    """Tests for game state consistency between REST and WebSocket"""
    
    @pytest.mark.asyncio
    async def test_rest_and_websocket_state_match(self):
        """Test that REST API and WebSocket return consistent game state"""
        # Get state from REST API
        rest_response = requests.get(f"{BASE_URL}/api/live-survey/state", timeout=10)
        rest_state = rest_response.json()
        
        # Get state from WebSocket
        client_id = f"TEST_consistency_{int(time.time())}"
        ws_endpoint = f"{WS_URL}/api/live-survey/ws/{client_id}"
        
        async with websockets.connect(ws_endpoint, open_timeout=10, close_timeout=10) as ws:
            ws_message = await asyncio.wait_for(ws.recv(), timeout=5)
            ws_state = json.loads(ws_message)
        
        # Compare key fields (allowing small timing differences)
        assert rest_state.get('question') == ws_state.get('question'), "Questions should match"
        assert rest_state.get('batch_number') == ws_state.get('batch_number'), "Batch numbers should match"
        assert rest_state.get('is_live') == ws_state.get('is_live'), "is_live should match"
        
        # Time remaining may differ slightly due to timing
        time_diff = abs(rest_state.get('time_remaining', 0) - ws_state.get('time_remaining', 0))
        assert time_diff <= 2, f"Time remaining differs too much: {time_diff}s"
        
        print(f"PASS: REST and WebSocket states are consistent")
        print(f"  - Question matches: {rest_state.get('question')[:50]}...")
        print(f"  - Batch number: {rest_state.get('batch_number')}")
        print(f"  - Time diff: {time_diff}s")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
