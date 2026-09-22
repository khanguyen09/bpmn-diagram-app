export const starterBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_Core_Starter"
  targetNamespace="https://the-experience.blog/bpmn/core-starter">
  <bpmn:process id="Process_Editorial_Review" name="Duyệt bài phân tích" isExecutable="false">
    <bpmn:startEvent id="Start_Submitted" name="Bản nháp sẵn sàng">
      <bpmn:outgoing>Flow_Start_Intake</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_Intake" name="Kiểm tra cấu trúc">
      <bpmn:incoming>Flow_Start_Intake</bpmn:incoming>
      <bpmn:outgoing>Flow_Intake_Decision</bpmn:outgoing>
    </bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_Ready" name="Đủ điều kiện?">
      <bpmn:incoming>Flow_Intake_Decision</bpmn:incoming>
      <bpmn:outgoing>Flow_Ready_Publish</bpmn:outgoing>
      <bpmn:outgoing>Flow_Revise</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:task id="Task_Publish" name="Chuẩn bị xuất bản">
      <bpmn:incoming>Flow_Ready_Publish</bpmn:incoming>
      <bpmn:outgoing>Flow_Publish_End</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_Revise" name="Bổ sung bằng chứng">
      <bpmn:incoming>Flow_Revise</bpmn:incoming>
      <bpmn:outgoing>Flow_Revise_End</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_Reviewed" name="Hoàn tất review">
      <bpmn:incoming>Flow_Publish_End</bpmn:incoming>
      <bpmn:incoming>Flow_Revise_End</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_Start_Intake" sourceRef="Start_Submitted" targetRef="Task_Intake" />
    <bpmn:sequenceFlow id="Flow_Intake_Decision" sourceRef="Task_Intake" targetRef="Gateway_Ready" />
    <bpmn:sequenceFlow id="Flow_Ready_Publish" name="Có" sourceRef="Gateway_Ready" targetRef="Task_Publish" />
    <bpmn:sequenceFlow id="Flow_Revise" name="Chưa" sourceRef="Gateway_Ready" targetRef="Task_Revise" />
    <bpmn:sequenceFlow id="Flow_Publish_End" sourceRef="Task_Publish" targetRef="End_Reviewed" />
    <bpmn:sequenceFlow id="Flow_Revise_End" sourceRef="Task_Revise" targetRef="End_Reviewed" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Core_Starter">
    <bpmndi:BPMNPlane id="Plane_Core_Starter" bpmnElement="Process_Editorial_Review">
      <bpmndi:BPMNShape id="Shape_Start" bpmnElement="Start_Submitted"><dc:Bounds x="110" y="202" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Intake" bpmnElement="Task_Intake"><dc:Bounds x="200" y="180" width="120" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Gateway" bpmnElement="Gateway_Ready" isMarkerVisible="true"><dc:Bounds x="380" y="195" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Publish" bpmnElement="Task_Publish"><dc:Bounds x="500" y="120" width="130" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Revise" bpmnElement="Task_Revise"><dc:Bounds x="500" y="250" width="130" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End" bpmnElement="End_Reviewed"><dc:Bounds x="710" y="202" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Start_Intake" bpmnElement="Flow_Start_Intake"><di:waypoint x="146" y="220" /><di:waypoint x="200" y="220" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Intake_Gateway" bpmnElement="Flow_Intake_Decision"><di:waypoint x="320" y="220" /><di:waypoint x="380" y="220" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Ready_Publish" bpmnElement="Flow_Ready_Publish"><di:waypoint x="405" y="195" /><di:waypoint x="405" y="160" /><di:waypoint x="500" y="160" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Ready_Revise" bpmnElement="Flow_Revise"><di:waypoint x="405" y="245" /><di:waypoint x="405" y="290" /><di:waypoint x="500" y="290" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Publish_End" bpmnElement="Flow_Publish_End"><di:waypoint x="630" y="160" /><di:waypoint x="728" y="160" /><di:waypoint x="728" y="202" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Revise_End" bpmnElement="Flow_Revise_End"><di:waypoint x="630" y="290" /><di:waypoint x="728" y="290" /><di:waypoint x="728" y="238" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
