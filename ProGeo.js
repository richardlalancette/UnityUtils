#pragma strict

import System.Collections.Generic;

//----------------------------------------
//  Various procedural geometry tools
//----------------------------------------

//----------------------------------------
//  Works in the XY plane, and basically uses XY position as UVs
//	TODO - have two radii - left and right radius
//----------------------------------------
static function Stroke2D( pts:Vector2[], width:float, mesh:Mesh )
{
	var npts = pts.length;
	var radius : float = width/2.0;

	var vertices = new Vector3[ 2 * npts ];
	var uvs = new Vector2[ 2 * npts ];

	var a = pts[0];
	var b = pts[1];
	var e0 = b-a;
	var n = Math2D.PerpCCW( e0 ).normalized;
	vertices[0] = a + n*radius;
	vertices[1] = a - n*radius;
	uvs[ 0 ] = Vector2( 0,0 );
	uvs[ 1 ] = Vector2( 1,0 );

	for( var i = 1; i < npts-1; i++ )
	{
		var p0 = pts[i-1];
		var p1 = pts[i];
		var p2 = pts[i+1];
		e0 = p1-p0;
		var e1 = p2-p1;

		var e0n = e0.normalized;
		var e1n = e1.normalized;
		var theta0 = Mathf.Atan2( e0n.y, e0n.x );
		var theta1 = Mathf.Atan2( e1n.y, e1n.x );

		// make sure we're getting the positive CCW angle from e0 to e1
		if( theta1 < theta0 )
			theta1 += 2*Mathf.PI;

		var dtheta = theta1 - theta0;
		var alpha = radius * Mathf.Tan( dtheta/2.0 );

		n = Math2D.PerpCCW( e0 ).normalized;
		vertices[ 2*i ] = p1+radius*n - alpha*e0n;
		vertices[ 2*i+1 ] = p1-radius*n + alpha*e0n;

		var v = (1.0*i) / (npts-1.0);
		uvs[ 2*i ] = Vector2( 0, v );
		uvs[ 2*i+1 ] = Vector2( 1, v );
	}

	// last one
	a = pts[ npts-2 ];
	b = pts[ npts-1 ];
	e0 = b-a;
	n = Math2D.PerpCCW( e0 ).normalized;
	vertices[ 2*npts-2 ] = b + n*radius;
	vertices[ 2*npts-1 ] = b - n*radius;
	uvs[ 2*npts-2 ] = Vector2( 0, 1 );
	uvs[ 2*npts-1 ] = Vector2( 1, 1 );

	//----------------------------------------
	//  Triangles
	//----------------------------------------
	var ntris = 2*(npts-1);
	var triangles = new int[ ntris * 3 ];
	for( i = 0; i < (npts-1); i++ )
	{
		triangles[ 6*i + 0 ] = 2 * i + 0;
		triangles[ 6*i + 1 ] = 2 * i + 2;
		triangles[ 6*i + 2 ] = 2 * i + 1;

		triangles[ 6*i + 3 ] = 2 * i + 1;
		triangles[ 6*i + 4 ] = 2 * i + 2;
		triangles[ 6*i + 5 ] = 2 * i + 3;
	}

	//----------------------------------------
	//  Assign
	//----------------------------------------
	mesh.vertices = vertices;
	mesh.uv = uvs;
	mesh.triangles = triangles;

	// set all normals to -Z
	var normals = new Vector3[ 2 * npts ];
	for( i = 0; i < normals.length; i++ )
		normals[i] = Vector3( 0, 0, -1 );

	mesh.normals = normals;
}

//----------------------------------------
//  pts - the ordered points of a closed polygon
//----------------------------------------
static function ClipByLine(
		pts:Vector2[],
		l0:Vector2,
		l1:Vector2,
		keepRight:boolean )
		: Array
{
	var npts = pts.length;

	if( !keepRight )
	{
		// just swap the two
		var temp = l0;
		l0 = l1;
		l1 = temp;
	}

	var lineDir = (l1-l0).normalized;
	var rightDir = -1 * Math2D.PerpCCW( lineDir ).normalized;

	// figure out which line segs cross the line
	var ptIsOnRight = new boolean[ npts ];
	
	for( var i = 0; i < npts; i++ )
	{
		var toPt = (pts[i] - l0).normalized;
		ptIsOnRight[i] = (Vector2.Dot( toPt, rightDir ) > 0 );
	}

	var segCrosses = new boolean[npts];
	for( i = 0; i < npts; i++ )
	{
		if( ptIsOnRight[i] != ptIsOnRight[(i+1)%npts] )
			segCrosses[i] = true;
		else
			segCrosses[i] = false;
	}

	//----------------------------------------
	//  Now perform the generation of the new polygon
	//	Pretty simple logic.
	//----------------------------------------
	var newPts = new Array();

	for( i = 0; i < npts; i++ )
	{
		if( ptIsOnRight[i] )
			newPts.Push( pts[i] );

		if( segCrosses[i] )
		{
			// add the intersection point
			var p0 = pts[i];
			var p1 = pts[(i+1)%npts];
			var intx = Math2D.Intersect2DLines( l0, l1, p0, p1 );
			newPts.Push(intx);
		}
	}

	return newPts;
}

//----------------------------------------
//  TODO - Mes
//----------------------------------------
class Polygon2D
{
	var pts : Vector2[] = null;
	var edgeA : int[] = null;
	var edgeB : int[] = null;

	function Duplicate() : Polygon2D
	{
		var dupe = new Polygon2D();
		dupe.pts = Utils.Duplicate( pts );
		dupe.edgeA = Utils.Duplicate( edgeA );
		dupe.edgeB = Utils.Duplicate( edgeB );
		return dupe;
	}

	function GetNumVertices() : int { return pts.length; }
	function GetNumEdges() : int { return edgeA.length; }

	function DebugDraw( color:Color, dur:float )
	{
		for( var e = 0; e < edgeA.length; e++ )
		{
			var a = edgeA[e];
			var b = edgeB[e];
			Debug.DrawLine( Utils.ToVector3( pts[a]), Utils.ToVector3(pts[b]), color, dur, false );
		}
	}

	function ScalePoints( s:float )
	{
		for( var i = 0; i < pts.length; i++ )
			pts[i] *= s;
	}

	function Reflect( l0:Vector2, l1:Vector2, keepRight:boolean )
	{
		var npts = pts.length;

		if( !keepRight )
		{
			// just swap the two
			var temp = l0;
			l0 = l1;
			l1 = temp;
		}
		var lineDir = (l1-l0).normalized;
		var rightDir = -1 * Math2D.PerpCCW( lineDir ).normalized;

		// see which points are on the right side
		var ptIsOnRight = new boolean[ npts ];
		for( var i = 0; i < npts; i++ )
		{
			var toPt = (pts[i] - l0).normalized;
			ptIsOnRight[i] = (Vector2.Dot( toPt, rightDir ) > 0 );
		}

		// keep right points and add their reflections
		var newPts = new Array();
		var pt2refl = new int[ npts ];
		var old2new = new int[ npts ];
		for( i = 0; i < npts; i++ )
		{
			if( ptIsOnRight[i] )
			{
				newPts.Push( pts[i] );
				old2new[i] = newPts.length-1;

				// add reflection
				newPts.Push( Math2D.Reflect2D( pts[i], l0, l1 ) );
				pt2refl[i] = newPts.length-1;
			}
		}

		// go through edges
		var newA = new Array();
		var newB = new Array();

		for( i = 0; i < edgeA.length; i++ )
		{
			var a = edgeA[i];
			var b = edgeB[i];

			if( ptIsOnRight[a] && ptIsOnRight[b] )
			{
				// yay add both this one and its reflection, going in the opposite direction
				newA.Push( old2new[a] );
				newB.Push( old2new[b] );

				// note the opposite direction
				newA.Push( pt2refl[b] );
				newB.Push( pt2refl[a] );
			}
			else if( ptIsOnRight[a] && !ptIsOnRight[b] )
			{
				// add the intersection point
				var intx = Math2D.Intersect2DLines( l0, l1, pts[a], pts[b] );
				newPts.Push( intx );
				var c = newPts.length-1;

				// register new edges
				newA.Push( old2new[a] );
				newB.Push( c );

				// now its reflection with opposite direction
				newA.Push( c );
				newB.Push( pt2refl[a] );
			}
			else if( !ptIsOnRight[a] && ptIsOnRight[b] )
			{
				// add the intersection point
				intx = Math2D.Intersect2DLines( l0, l1, pts[a], pts[b] );
				newPts.Push( intx );
				c = newPts.length-1;

				// register new edges
				newA.Push( pt2refl[b] );
				newB.Push( c );

				// now its reflection with opposite direction
				newA.Push( c );
				newB.Push( old2new[b] );
			}
			else
			{
				// edge is completely on left side - ignore
			}
		}

		pts = newPts.ToBuiltin(Vector2);
		edgeA = newA.ToBuiltin(int);
		edgeB = newB.ToBuiltin(int);
	}

	function Append( other:Polygon2D )
	{
		if( pts == null ) pts = new Vector2[0];
		if( edgeA == null ) edgeA = new int[0];
		if( edgeB == null ) edgeB = new int[0];
		var oldNumPts = pts.length;
		var oldNumEdges = edgeA.length;

		pts = Utils.Concatenate( pts, other.pts );
		edgeA = Utils.Concatenate( edgeA, other.edgeA );
		edgeB = Utils.Concatenate( edgeB, other.edgeB );

		// need to increment other edge indices
		for( var i = 0; i < other.edgeA.length; i++ )
		{
			edgeA[ oldNumEdges + i ] += oldNumPts;
			edgeB[ oldNumEdges + i ] += oldNumPts;
		}
	}
}

//----------------------------------------
//  For efficient vertex-neighbor queries
//----------------------------------------
class PolyVertexNbors
{
	private var data:int[];

	function GetPrev( vid:int ):int { return data[ 2*vid + 0 ]; }
	function GetNext( vid:int ):int { return data[ 2*vid + 1 ]; }

	function SetPrev( vid:int, nbor:int ) { data[ 2*vid + 0 ] = nbor; }
	function SetNext( vid:int, nbor:int ) { data[ 2*vid + 1 ] = nbor; }

	function AreNeighbors( a:int, b:int ) {
		return GetPrev( a ) == b || GetPrev( b ) == a;
	}

	function Reset( poly:Polygon2D )
	{
		data = new int[ 2*poly.GetNumVertices() ];
		for( var eid = 0; eid < poly.GetNumEdges(); eid++ )
		{
			var a = poly.edgeA[ eid ];
			var b = poly.edgeB[ eid ];

			SetPrev( b, a );
			SetNext( a, b );
		}
	}
}

class Vector3IdPair {
	var v : Vector3;
	var id : int;

	static function CompareByX( a:Vector3IdPair, b:Vector3IdPair ) {
		return Mathf.RoundToInt( Mathf.Sign( a.v.x - b.v.x ) );
	}
}

class TriIndices {
	var verts = new int[3];
}

//----------------------------------------
//	O( n log n) polygon triangulation algorithm
//  Reference: http://www.cs.ucsb.edu/~suri/cs235/Triangulation.pdf
//----------------------------------------
static function TriangulatePolygon( poly:Polygon2D, mesh:Mesh )
{
	var sortedVerts = new List.<Vector3IdPair>();

	// first just copy over the vertices - we introduce no new verts using this triangulation algorithm
	for( var i = 0; i < poly.GetNumVertices(); i++ ) {
		var pair = new Vector3IdPair();
		pair.v = poly.pts[i];
		pair.id = i;
		sortedVerts.Add( pair );
	}

	// Sort vertices by x
	sortedVerts.Sort( Vector3IdPair.CompareByX );

	// create nbor query datastructure
	var nbors = new PolyVertexNbors();
	nbors.Reset( poly );

	// Triangulate
	var tris = new List.<TriIndices>();

	var sidStack = new Stack.<int>();
	sidStack.Push( 0 );
	sidStack.Push( 1 );
	for( var aSid = 2; aSid < sortedVerts.Count; aSid++ )
	{
		var aVid = sortedVerts[ aSid ].id;
		var aPt = poly.pts[ aVid ];

		var topSid = sidStack.Peek();
		var topVid = sortedVerts[ topSid ].id;

// TEMP TEMP
		if( nbors.AreNeighbors( aVid, topVid ) )
		{
			var botCase = (nbors.GetPrev( aVid ) == topVid);

			while( sidStack.Count > 0 ) {
				var bSid = sidStack.Pop();
				var bVid = sortedVerts[ bSid ].id;
				if( sidStack.Count == 0 ) {
					// 
					sidStack.Push( bSid );
					sidStack.Push( aSid );
					break;
				}
				var cSid = sidStack.Pop();
				var cVid = sortedVerts[ cSid ].id;

				// see if this makes a valid inside-polygon triangle
				var bPt = poly.pts[ bVid ];
				var cPt = poly.pts[ cVid ];

				var tri:TriIndices = null;
				if( botCase ) {
					if( Math2D.IsRightOfLine( bPt, cPt, aPt ) ) {
						tri = new TriIndices();
						tri.verts[0] = aVid;
						tri.verts[1] = cVid;
						tri.verts[2] = bVid;
					}
				}
				else {
					if( Math2D.IsLeftOfLine( bPt, cPt, aPt ) ) {
						tri = new TriIndices();
						tri.verts[0] = aVid;
						tri.verts[1] = bVid;
						tri.verts[2] = cVid;
					}
				}

				if( tri != null ) {
					tris.Add( tri );
					sidStack.Push( cSid );
				}
				else {
					// couldn't make a tri, push these guys back on, and we're done
					sidStack.Push( cSid );
					sidStack.Push( bSid );
					sidStack.Push( aSid );
					break;
				}
			}
		}
		else {
			// not neighbors
			while( sidStack.Count > 0 ) {
				bSid = sidStack.Pop();
				// was this our last one?
				if( sidStack.Count == 0 ) break;
				bVid = sortedVerts[ bSid ].id;
				cSid = sidStack.Pop();
				cVid = sortedVerts[ cSid ].id;

				// see if this makes a valid inside-polygon triangle
				bPt = poly.pts[ bVid ];
				cPt = poly.pts[ cVid ];

				tri = new TriIndices();

				if( Math2D.IsRightOfLine( bPt, cPt, aPt ) ) {
					tri.verts[0] = aVid;
					tri.verts[1] = cVid;
					tri.verts[2] = bVid;
					tris.Add(tri);
				}
				else if( Math2D.IsLeftOfLine( bPt, cPt, aPt ) ) {
					tri.verts[0] = aVid;
					tri.verts[1] = bVid;
					tri.verts[2] = cVid;
					tris.Add(tri);
				}
				// don't add degen tris
				
				// put C back on for the next iter
				sidStack.Push( cSid );
			}

			// done
			sidStack.Push( topSid );
			sidStack.Push( aSid );
		}
	}

	//----------------------------------------
	//  Finally, transfer to the mesh
	//----------------------------------------
	var meshVerts = new Vector3[ poly.GetNumVertices() ];
	var triangles = new int[ 3*tris.Count ];

	for( i = 0; i < poly.GetNumVertices(); i++ ) {
		meshVerts[i] = poly.pts[i];
	}
	for( i = 0; i < tris.Count; i++ ) {
		for( var j = 0; j < 3; j++ )
			triangles[ 3*i+j ] = tris[i].verts[j];
	}

	mesh.vertices = meshVerts;
	mesh.triangles = triangles;
}

static function BuildBeltMesh(
		pts:Vector2[],
		edgeA:int[], edgeB:int[],
		zMin:float, zMax:float,
		normalPointingRight:boolean,
		mesh:Mesh )
{
	var npts = pts.length;

	var vertices = new Vector3[ 2*npts ];
	for( var i = 0; i < npts; i++ )
	{
		var p = pts[i];
		vertices[2*i+0] = Vector3( p.x, p.y, zMin );
		vertices[2*i+1] = Vector3( p.x, p.y, zMax );
	}

	var ntris = 2 * edgeA.length;
	var triangles = new int[ ntris * 3 ];

	for( i = 0; i < edgeA.length; i++ )
	{
		var a = edgeA[i];
		var b = edgeB[i];

		if( normalPointingRight )
		{
			triangles[ 6*i + 0 ] = 2 * a + 0;
			triangles[ 6*i + 1 ] = 2 * b + 0;
			triangles[ 6*i + 2 ] = 2 * a + 1;

			triangles[ 6*i + 3 ] = 2 * b + 0;
			triangles[ 6*i + 4 ] = 2 * b + 1;
			triangles[ 6*i + 5 ] = 2 * a + 1;
		}
		else
		{
			triangles[ 6*i + 0 ] = 2 * a + 0;
			triangles[ 6*i + 1 ] = 2 * a + 1;
			triangles[ 6*i + 2 ] = 2 * b + 0;

			triangles[ 6*i + 3 ] = 2 * b + 0;
			triangles[ 6*i + 4 ] = 2 * a + 1;
			triangles[ 6*i + 5 ] = 2 * b + 1;
		}
	}

	// finalize
	// TODO - UVs
	mesh.vertices = vertices;
	mesh.triangles = triangles;
	mesh.RecalculateNormals();
}