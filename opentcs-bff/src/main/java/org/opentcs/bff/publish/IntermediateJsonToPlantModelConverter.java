// SPDX-FileCopyrightText: The openTCS Authors
// SPDX-License-Identifier: MIT
package org.opentcs.bff.publish;

import static java.util.Objects.requireNonNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.awt.Color;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.opentcs.access.to.model.BlockCreationTO;
import org.opentcs.access.to.model.BoundingBoxCreationTO;
import org.opentcs.access.to.model.LocationCreationTO;
import org.opentcs.access.to.model.LocationRepresentationTO;
import org.opentcs.access.to.model.LocationTypeCreationTO;
import org.opentcs.access.to.model.PathCreationTO;
import org.opentcs.access.to.model.PlantModelCreationTO;
import org.opentcs.access.to.model.PointCreationTO;
import org.opentcs.access.to.model.PoseCreationTO;
import org.opentcs.access.to.model.TripleCreationTO;
import org.opentcs.access.to.model.VehicleCreationTO;

/**
 * Packs the SPA's intermediate-JSON {@code payload} (envelope v2) into a
 * {@link PlantModelCreationTO}.
 *
 * <p>This converter is intentionally a <em>mirror</em>: no unit conversion, no enum renaming,
 * no field rewrites. The SPA's {@code DraftPoint / DraftPath / DraftLocation / …} types are
 * 1:1 mirrors of the openTCS {@code *CreationTO} classes (see ADR-0003 in
 * {@code spa-frontend-architecture.md}), so all this layer does is:
 * <ol>
 * <li>walk the JSON arrays,</li>
 * <li>validate required fields + referential integrity (path src/dest, location.type, …),</li>
 * <li>drop editor-only fields ({@code layout.pixelX/Y}, {@code layout.orientationDeg}),</li>
 * <li>build the corresponding {@code *CreationTO} via its {@code withX} builders.</li>
 * </ol>
 *
 * <p>On any malformed / missing / dangling reference, throws {@link PublishValidationException}
 * with a {@code fieldPath} (e.g. {@code paths[3].srcPointName}) so the SPA can hop back to the
 * offending entity.
 */
public final class IntermediateJsonToPlantModelConverter {

  private IntermediateJsonToPlantModelConverter() {
  }

  /**
   * Converts the SPA's intermediate-JSON payload into a {@link PlantModelCreationTO}.
   *
   * @param payload The {@code payload} sub-tree of the SPA draft envelope v2 (the part containing
   * {@code points/paths/locationTypes/locations/blocks/vehicles}).
   * @param modelName The plant-model name to embed in the TO.
   * @return A fully-built {@link PlantModelCreationTO}.
   * @throws PublishValidationException If the payload is missing required fields, has dangling
   * references, or otherwise can't be packed.
   */
  public static PlantModelCreationTO toCreationTO(JsonNode payload, String modelName) {
    requireNonNull(payload, "payload");
    if (!payload.isObject()) {
      throw new PublishValidationException(null, "payload must be a JSON object");
    }
    String name = (modelName == null || modelName.isBlank()) ? "PlantModel" : modelName;

    PlantModelCreationTO to = new PlantModelCreationTO(name);

    // Collect names first so cross-entity references can be validated up-front.
    Set<String> pointNames = collectNames(payload, "points");
    Set<String> locationTypeNames = collectNames(payload, "locationTypes");
    Set<String> locationNames = collectNames(payload, "locations");

    JsonNode points = payload.path("points");
    for (int i = 0; i < points.size(); i++) {
      to = to.withPoint(convertPoint(points.get(i), "points[" + i + "]"));
    }
    JsonNode locTypes = payload.path("locationTypes");
    for (int i = 0; i < locTypes.size(); i++) {
      to = to.withLocationType(convertLocationType(locTypes.get(i), "locationTypes[" + i + "]"));
    }
    JsonNode locations = payload.path("locations");
    for (int i = 0; i < locations.size(); i++) {
      String fp = "locations[" + i + "]";
      to = to.withLocation(convertLocation(locations.get(i), fp, locationTypeNames, pointNames));
    }
    JsonNode paths = payload.path("paths");
    for (int i = 0; i < paths.size(); i++) {
      to = to.withPath(convertPath(paths.get(i), "paths[" + i + "]", pointNames));
    }
    JsonNode blocks = payload.path("blocks");
    for (int i = 0; i < blocks.size(); i++) {
      String fp = "blocks[" + i + "]";
      to = to.withBlock(
          convertBlock(blocks.get(i), fp, pointNames, locationNames, payload)
      );
    }
    JsonNode vehicles = payload.path("vehicles");
    for (int i = 0; i < vehicles.size(); i++) {
      to = to.withVehicle(convertVehicle(vehicles.get(i), "vehicles[" + i + "]"));
    }
    return to;
  }

  /* ------------------------------- Points --------------------------------- */

  private static PointCreationTO convertPoint(JsonNode node, String fp) {
    String name = requireText(node, "name", fp);
    PointCreationTO.Type type = parseEnum(
        node.path("type").asText("HALT_POSITION"),
        PointCreationTO.Type.class,
        fp + ".type"
    );
    PoseCreationTO pose = convertPose(node.path("pose"), fp + ".pose");
    return new PointCreationTO(name)
        .withType(type)
        .withPose(pose)
        .withProperties(readProperties(node.path("properties")));
  }

  private static PoseCreationTO convertPose(JsonNode node, String fp) {
    if (node.isMissingNode() || node.isNull()) {
      throw new PublishValidationException(fp, "pose is required");
    }
    TripleCreationTO position = convertTriple(node.path("position"), fp + ".position");
    double angle = parseDoubleAllowingNaN(node.path("orientationAngle"), fp + ".orientationAngle");
    return new PoseCreationTO(position, angle);
  }

  private static TripleCreationTO convertTriple(JsonNode node, String fp) {
    if (node.isMissingNode() || node.isNull()) {
      throw new PublishValidationException(fp, "position is required");
    }
    long x = requireLong(node, "x", fp);
    long y = requireLong(node, "y", fp);
    long z = node.has("z") && !node.path("z").isNull() ? node.path("z").asLong(0L) : 0L;
    return new TripleCreationTO(x, y, z);
  }

  /* -------------------------------- Paths --------------------------------- */

  private static PathCreationTO convertPath(JsonNode node, String fp, Set<String> pointNames) {
    String name = requireText(node, "name", fp);
    String src = requireText(node, "srcPointName", fp);
    String dest = requireText(node, "destPointName", fp);
    if (!pointNames.contains(src)) {
      throw new PublishValidationException(
          fp + ".srcPointName", "srcPoint '" + src + "' does not exist"
      );
    }
    if (!pointNames.contains(dest)) {
      throw new PublishValidationException(
          fp + ".destPointName", "destPoint '" + dest + "' does not exist"
      );
    }
    return new PathCreationTO(name, src, dest)
        .withLength(Math.max(1L, node.path("length").asLong(1L)))
        .withMaxVelocity(node.path("maxVelocity").asInt(0))
        .withMaxReverseVelocity(node.path("maxReverseVelocity").asInt(0))
        .withLocked(node.path("locked").asBoolean(false))
        .withProperties(readProperties(node.path("properties")));
  }

  /* --------------------------- LocationType ------------------------------- */

  private static LocationTypeCreationTO convertLocationType(JsonNode node, String fp) {
    String name = requireText(node, "name", fp);
    LocationTypeCreationTO out = new LocationTypeCreationTO(name)
        .withAllowedOperations(readStringList(node.path("allowedOperations")))
        .withAllowedPeripheralOperations(readStringList(node.path("allowedPeripheralOperations")))
        .withProperties(readProperties(node.path("properties")));
    JsonNode layout = node.path("layout");
    if (!layout.isMissingNode() && !layout.isNull()) {
      LocationRepresentationTO rep = parseEnum(
          layout.path("locationRepresentation").asText("NONE"),
          LocationRepresentationTO.class,
          fp + ".layout.locationRepresentation"
      );
      out = out.withLayout(new LocationTypeCreationTO.Layout(rep));
    }
    return out;
  }

  /* ------------------------------ Location -------------------------------- */

  private static LocationCreationTO convertLocation(
      JsonNode node,
      String fp,
      Set<String> locationTypes,
      Set<String> pointNames
  ) {
    String name = requireText(node, "name", fp);
    String typeName = requireText(node, "typeName", fp);
    if (!locationTypes.contains(typeName)) {
      throw new PublishValidationException(
          fp + ".typeName", "locationType '" + typeName + "' does not exist"
      );
    }
    TripleCreationTO position = convertTriple(node.path("position"), fp + ".position");
    Map<String, Set<String>> links = new LinkedHashMap<>();
    JsonNode linksNode = node.path("links");
    if (linksNode.isArray()) {
      for (int i = 0; i < linksNode.size(); i++) {
        JsonNode link = linksNode.get(i);
        String pn = requireText(link, "pointName", fp + ".links[" + i + "]");
        if (!pointNames.contains(pn)) {
          throw new PublishValidationException(
              fp + ".links[" + i + "].pointName",
              "linked point '" + pn + "' does not exist"
          );
        }
        Set<String> ops = new LinkedHashSet<>(readStringList(link.path("allowedOperations")));
        links.put(pn, ops);
      }
    }
    LocationCreationTO out = new LocationCreationTO(name, typeName, position)
        .withLinks(links)
        .withLocked(node.path("locked").asBoolean(false))
        .withProperties(readProperties(node.path("properties")));
    JsonNode layout = node.path("layout");
    if (!layout.isMissingNode() && !layout.isNull()) {
      LocationRepresentationTO rep = parseEnum(
          layout.path("locationRepresentation").asText("NONE"),
          LocationRepresentationTO.class,
          fp + ".layout.locationRepresentation"
      );
      out = out.withLayout(
          new LocationCreationTO.Layout().withLocationRepresentation(rep)
      );
    }
    return out;
  }

  /* -------------------------------- Block --------------------------------- */

  private static BlockCreationTO convertBlock(
      JsonNode node,
      String fp,
      Set<String> pointNames,
      Set<String> locationNames,
      JsonNode payload
  ) {
    String name = requireText(node, "name", fp);
    BlockCreationTO.Type type = parseEnum(
        node.path("type").asText("SINGLE_VEHICLE_ONLY"),
        BlockCreationTO.Type.class,
        fp + ".type"
    );
    Set<String> pathNames = collectNames(payload, "paths");
    Set<String> members = new LinkedHashSet<>();
    JsonNode m = node.path("memberNames");
    if (m.isArray()) {
      for (int i = 0; i < m.size(); i++) {
        String mn = m.get(i).asText("");
        if (mn.isEmpty()) {
          throw new PublishValidationException(
              fp + ".memberNames[" + i + "]", "member name must not be empty"
          );
        }
        if (!pointNames.contains(mn)
            && !locationNames.contains(mn)
            && !pathNames.contains(mn)) {
          throw new PublishValidationException(
              fp + ".memberNames[" + i + "]",
              "member '" + mn + "' does not refer to any known point / location / path"
          );
        }
        members.add(mn);
      }
    }
    BlockCreationTO out = new BlockCreationTO(name)
        .withType(type)
        .withMemberNames(members)
        .withProperties(readProperties(node.path("properties")));
    JsonNode layout = node.path("layout");
    if (!layout.isMissingNode() && !layout.isNull()) {
      String hex = layout.path("colorRgb").asText("");
      if (!hex.isEmpty()) {
        out = out.withLayout(
            new BlockCreationTO.Layout(parseHexColor(hex, fp + ".layout.colorRgb"))
        );
      }
    }
    return out;
  }

  /* ------------------------------ Vehicle --------------------------------- */

  private static VehicleCreationTO convertVehicle(JsonNode node, String fp) {
    String name = requireText(node, "name", fp);
    VehicleCreationTO out = new VehicleCreationTO(name)
        .withMaxVelocity(node.path("maxVelocity").asInt(0))
        .withMaxReverseVelocity(node.path("maxReverseVelocity").asInt(0))
        .withEnvelopeKey(node.path("envelopeKey").asText(""))
        .withProperties(readProperties(node.path("properties")));
    JsonNode bb = node.path("boundingBox");
    if (!bb.isMissingNode() && !bb.isNull()) {
      long len = Math.max(1L, bb.path("length").asLong(1L));
      long width = Math.max(1L, bb.path("width").asLong(1L));
      long height = Math.max(0L, bb.path("height").asLong(0L));
      out = out.withBoundingBox(new BoundingBoxCreationTO(len, width, height));
    }
    JsonNode el = node.path("energyLevelThresholdSet");
    if (!el.isMissingNode() && !el.isNull()) {
      out = out.withEnergyLevelThresholdSet(
          new VehicleCreationTO.EnergyLevelThresholdSet(
              el.path("energyLevelCritical").asInt(30),
              el.path("energyLevelGood").asInt(90),
              el.path("energyLevelSufficientlyRecharged").asInt(30),
              el.path("energyLevelFullyRecharged").asInt(90)
          )
      );
    }
    JsonNode layout = node.path("layout");
    if (!layout.isMissingNode() && !layout.isNull()) {
      String hex = layout.path("routeColorRgb").asText("");
      if (!hex.isEmpty()) {
        out = out.withLayout(
            new VehicleCreationTO.Layout(parseHexColor(hex, fp + ".layout.routeColorRgb"))
        );
      }
    }
    return out;
  }

  /* ------------------------------ Helpers --------------------------------- */

  private static Set<String> collectNames(JsonNode payload, String arrayField) {
    JsonNode arr = payload.path(arrayField);
    if (!arr.isArray()) {
      return Collections.emptySet();
    }
    Set<String> out = new HashSet<>();
    for (int i = 0; i < arr.size(); i++) {
      String n = arr.get(i).path("name").asText("");
      if (!n.isEmpty()) {
        out.add(n);
      }
    }
    return out;
  }

  private static String requireText(JsonNode node, String field, String fp) {
    JsonNode v = node.path(field);
    if (v.isMissingNode() || v.isNull() || v.asText("").isEmpty()) {
      throw new PublishValidationException(fp + "." + field, field + " is required");
    }
    return v.asText();
  }

  private static long requireLong(JsonNode node, String field, String fp) {
    JsonNode v = node.path(field);
    if (v.isMissingNode() || v.isNull()) {
      throw new PublishValidationException(fp + "." + field, field + " is required");
    }
    if (!v.isNumber() && !(v.isTextual() && isParseableLong(v.asText()))) {
      throw new PublishValidationException(fp + "." + field, field + " must be an integer");
    }
    return v.asLong();
  }

  private static boolean isParseableLong(String s) {
    try {
      Long.parseLong(s);
      return true;
    }
    catch (NumberFormatException e) {
      return false;
    }
  }

  /** Parses a double accepting the SPA's {@code "NaN"/"Infinity"/"-Infinity"} string form. */
  private static double parseDoubleAllowingNaN(JsonNode v, String fp) {
    if (v.isMissingNode() || v.isNull()) {
      return Double.NaN;
    }
    if (v.isNumber()) {
      return v.doubleValue();
    }
    if (v.isTextual()) {
      String s = v.asText();
      switch (s) {
        case "NaN":
          return Double.NaN;
        case "Infinity":
          return Double.POSITIVE_INFINITY;
        case "-Infinity":
          return Double.NEGATIVE_INFINITY;
        default:
          try {
            return Double.parseDouble(s);
          }
          catch (NumberFormatException e) {
            throw new PublishValidationException(fp, "must be a number or NaN/Infinity");
          }
      }
    }
    throw new PublishValidationException(fp, "must be a number");
  }

  private static <E extends Enum<E>> E parseEnum(String text, Class<E> type, String fp) {
    try {
      return Enum.valueOf(type, text);
    }
    catch (IllegalArgumentException e) {
      throw new PublishValidationException(
          fp, "'" + text + "' is not a valid " + type.getSimpleName()
      );
    }
  }

  private static java.util.List<String> readStringList(JsonNode node) {
    if (!node.isArray()) {
      return Collections.emptyList();
    }
    java.util.List<String> out = new java.util.ArrayList<>(node.size());
    for (int i = 0; i < node.size(); i++) {
      out.add(node.get(i).asText(""));
    }
    return out;
  }

  private static Map<String, String> readProperties(JsonNode node) {
    if (!node.isObject()) {
      return Collections.emptyMap();
    }
    Map<String, String> out = new LinkedHashMap<>();
    Iterator<String> it = node.fieldNames();
    while (it.hasNext()) {
      String key = it.next();
      out.put(key, node.get(key).asText(""));
    }
    return out;
  }

  private static Color parseHexColor(String hex, String fp) {
    String h = hex.startsWith("#") ? hex.substring(1) : hex;
    if (h.length() != 6) {
      throw new PublishValidationException(fp, "color must be #RRGGBB, was '" + hex + "'");
    }
    try {
      return new Color(Integer.parseInt(h, 16));
    }
    catch (NumberFormatException e) {
      throw new PublishValidationException(fp, "color must be #RRGGBB hex, was '" + hex + "'");
    }
  }
}
