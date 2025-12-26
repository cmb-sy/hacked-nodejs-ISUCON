import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('${dynamodb_table_name}')

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj)
    raise TypeError

def lambda_handler(event, context):
    http_method = event.get('requestContext', {}).get('http', {}).get('method', '')
    
    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    if http_method == 'GET':
        # Get all teams and their scores
        try:
            response = table.scan()
            items = response.get('Items', [])
            # Sort by score descending
            items.sort(key=lambda x: x.get('score', 0), reverse=True)
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(items, default=decimal_default)
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': str(e)})
            }
    
    elif http_method == 'PUT':
        # Update team score
        try:
            body = json.loads(event.get('body', '{}'))
            team = body.get('team')
            score = body.get('score')
            timestamp = body.get('timestamp')
            
            if not team or score is None:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'team and score are required'})
                }
            
            table.put_item(Item={
                'team': team,
                'score': score,
                'timestamp': timestamp or ''
            })
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'Score updated successfully'})
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': str(e)})
            }
    
    elif http_method == 'DELETE':
        # Delete all scores (reset)
        try:
            response = table.scan()
            items = response.get('Items', [])
            for item in items:
                table.delete_item(Key={'team': item['team']})
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'message': 'All scores deleted'})
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': str(e)})
            }
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Method not allowed'})
    }
